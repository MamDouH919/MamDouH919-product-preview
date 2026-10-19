import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Page } from './schemas/page.schema';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { compressImage, toPublicPath, deleteFile } from '../common/helpers/compress-image';
import { tenantImageStorage } from '../common/helpers/upload-storage';
import { sanitizeDeep } from '../common/helpers/sanitize-html';

export const pageImageStorage = tenantImageStorage('pages');

const IMAGE_MIME = /^image\/(jpeg|png|webp|gif|avif)$/;

/** Rejects anything that isn't a raster image (SVG can carry script). */
export const pageImageFilter = (
  _req: unknown,
  file: Express.Multer.File,
  cb: (error: Error | null, accept: boolean) => void,
) => {
  if (IMAGE_MIME.test(file.mimetype)) return cb(null, true);
  cb(new BadRequestException('Only JPG, PNG, WEBP, GIF or AVIF images are allowed'), false);
};

// Lowercase latin/Arabic letters and digits, separated by single hyphens.
const SLUG_PATTERN = /^[a-z0-9؀-ۿ]+(?:-[a-z0-9؀-ۿ]+)*$/;

// Pages are served at /<locale>/<slug>, so a slug must not shadow a real route.
// Anything starting with admin/account is also caught by the frontend auth
// proxy (it matches on substring), so those prefixes are refused outright.
const RESERVED_SLUGS = new Set([
  'products',
  'categories',
  'cart',
  'checkout',
  'contact',
  'login',
  'forgot-password',
  'reset-password',
  'api',
  'uploads',
]);
const RESERVED_PREFIXES = ['admin', 'account'];

function normalizeSlug(raw: string): string {
  const slug = (raw ?? '').trim().toLowerCase().replace(/\s+/g, '-').replace(/-+/g, '-');
  if (!SLUG_PATTERN.test(slug)) {
    throw new BadRequestException(
      'Slug may contain only letters, numbers and single hyphens',
    );
  }
  if (RESERVED_SLUGS.has(slug) || RESERVED_PREFIXES.some((p) => slug.startsWith(p))) {
    throw new BadRequestException(`Slug "${slug}" is reserved`);
  }
  return slug;
}

/** Every file under this module's upload folder referenced anywhere in `value`. */
function collectAssets(value: unknown, out = new Set<string>()): Set<string> {
  if (typeof value === 'string') {
    if (value.startsWith('/uploads/') && value.includes('/pages/')) out.add(value);
  } else if (Array.isArray(value)) {
    value.forEach((v) => collectAssets(v, out));
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((v) => collectAssets(v, out));
  }
  return out;
}

@Injectable()
export class PagesService {
  constructor(@InjectModel(Page.name) private pageModel: Model<Page>) {}

  private async assertSlugFree(slug: string, exceptId?: string) {
    const clash = await this.pageModel
      .exists({ slug, ...(exceptId ? { _id: { $ne: exceptId } } : {}) })
      .exec();
    if (clash) throw new ConflictException(`A page with slug "${slug}" already exists`);
  }

  /** Deletes files no other page still references. */
  private async releaseAssets(paths: string[], ownerId: string) {
    for (const path of paths) {
      const usedElsewhere = await this.pageModel
        .exists({ _id: { $ne: ownerId }, assets: path })
        .exec();
      if (!usedElsewhere) await deleteFile(path);
    }
  }

  async create(dto: CreatePageDto): Promise<Page> {
    const slug = normalizeSlug(dto.slug);
    await this.assertSlugFree(slug);

    const blocks = sanitizeDeep(dto.blocks ?? []);
    const page = new this.pageModel({
      ...dto,
      slug,
      blocks,
      assets: [...collectAssets([blocks, dto.ogImage])],
    });
    return page.save();
  }

  /** Dashboard listing — blocks are left out to keep the payload small. */
  async findAll(): Promise<Page[]> {
    return this.pageModel.find().select('-blocks').sort({ order: 1, createdAt: -1 }).exec();
  }

  /** Public: published pages that should appear in the header or footer. */
  async findNavigation() {
    return this.pageModel
      .find({ isPublished: true, $or: [{ showInHeader: true }, { showInFooter: true }] })
      .select('slug title showInHeader showInFooter order')
      .sort({ order: 1, createdAt: 1 })
      .exec();
  }

  /** Public: a published page by slug. Drafts are never served here. */
  async findPublishedBySlug(rawSlug: string): Promise<Page> {
    const slug = decodeURIComponent(rawSlug).trim().toLowerCase();
    const page = await this.pageModel.findOne({ slug, isPublished: true }).exec();
    if (!page) throw new NotFoundException(`Page "${slug}" not found`);
    return page;
  }

  async findOne(id: string): Promise<Page> {
    const page = await this.pageModel.findById(id).exec();
    if (!page) throw new NotFoundException(`Page with id ${id} not found`);
    return page;
  }

  async update(id: string, dto: UpdatePageDto): Promise<Page> {
    // Lean, so collectAssets walks plain data rather than a Mongoose document
    // (whose internals point back at the parent and would recurse forever).
    const existing = await this.pageModel.findById(id).select('+assets').lean().exec();
    if (!existing) throw new NotFoundException(`Page with id ${id} not found`);

    const update: Record<string, any> = { ...dto };

    if (dto.slug !== undefined) {
      update.slug = normalizeSlug(dto.slug);
      if (update.slug !== existing.slug) await this.assertSlugFree(update.slug, id);
    }

    if (dto.blocks !== undefined) update.blocks = sanitizeDeep(dto.blocks);

    const blocks = update.blocks ?? existing.blocks;
    const ogImage = dto.ogImage !== undefined ? dto.ogImage : existing.ogImage;
    const assets = collectAssets([blocks, ogImage]);
    update.assets = [...assets];

    const updated = await this.pageModel
      .findByIdAndUpdate(id, update, { returnDocument: 'after' })
      .exec();

    const dropped = (existing.assets ?? []).filter((a) => !assets.has(a));
    await this.releaseAssets(dropped, id);

    return updated as Page;
  }

  /** Copies a page as an unpublished draft. Images are shared, not copied. */
  async duplicate(id: string): Promise<Page> {
    const source = await this.pageModel.findById(id).select('+assets').lean().exec();
    if (!source) throw new NotFoundException(`Page with id ${id} not found`);

    let slug = `${source.slug}-copy`;
    for (let n = 2; await this.pageModel.exists({ slug }).exec(); n++) {
      slug = `${source.slug}-copy-${n}`;
    }

    const { _id, createdAt, updatedAt, __v, ...rest } = source as any;
    const copy = new this.pageModel({
      ...rest,
      slug,
      isPublished: false,
      showInHeader: false,
      showInFooter: false,
    });
    return copy.save();
  }

  async remove(id: string): Promise<Page> {
    const page = await this.pageModel.findByIdAndDelete(id).select('+assets').exec();
    if (!page) throw new NotFoundException(`Page with id ${id} not found`);
    await this.releaseAssets(page.assets ?? [], id);
    return page;
  }

  /** Stores one uploaded image and returns the path blocks reference it by. */
  async uploadImage(file?: Express.Multer.File): Promise<{ path: string }> {
    if (!file) throw new BadRequestException('No image uploaded');
    const compressed = await compressImage(file, { maxWidth: 1920, quality: 85 });
    return { path: toPublicPath(compressed) };
  }
}
