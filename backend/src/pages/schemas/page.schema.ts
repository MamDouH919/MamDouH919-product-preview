import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { LocalizedField, LocalizedFieldSchema } from '../../common/schemas/localized-field.schema';

/** Every block the page builder knows how to render. */
export enum PageBlockType {
  HERO = 'hero',
  RICH_TEXT = 'richText',
  IMAGE = 'image',
  IMAGE_TEXT = 'imageText',
  GALLERY = 'gallery',
  FEATURES = 'features',
  STATS = 'stats',
  CTA = 'cta',
  FAQ = 'faq',
  VIDEO = 'video',
  BUTTONS = 'buttons',
  PRODUCTS = 'products',
  SPACER = 'spacer',
  DIVIDER = 'divider',
}

export enum PageWidth {
  SM = 'sm',
  MD = 'md',
  LG = 'lg',
  XL = 'xl',
  FULL = 'full',
}

/**
 * One block on a page. `data` holds the block's content and its shape depends
 * on `type`, so it is stored as Mixed; `style` holds the presentation options
 * every block shares (colors, spacing, width).
 */
export class PageBlock {
  id!: string;
  type!: PageBlockType;
  visible!: boolean;
  style?: Record<string, any>;
  data!: Record<string, any>;
}

@Schema({ _id: false })
export class PageSettings {
  @Prop({ enum: PageWidth, default: PageWidth.LG })
  maxWidth!: PageWidth;

  @Prop({ required: false })
  backgroundColor?: string;

  @Prop({ required: false })
  textColor?: string;

  @Prop({ default: true })
  showTitle!: boolean;
}

export const PageSettingsSchema = SchemaFactory.createForClass(PageSettings);

@Schema({ timestamps: true })
export class Page extends Document {
  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  slug!: string;

  @Prop({ required: true, type: LocalizedFieldSchema })
  title!: LocalizedField;

  @Prop({ required: false, type: LocalizedFieldSchema })
  metaTitle?: LocalizedField;

  @Prop({ required: false, type: LocalizedFieldSchema })
  metaDescription?: LocalizedField;

  @Prop({ required: false })
  ogImage?: string;

  @Prop({ default: false })
  isPublished!: boolean;

  @Prop({ default: false })
  showInHeader!: boolean;

  @Prop({ default: false })
  showInFooter!: boolean;

  @Prop({ default: 0 })
  order!: number;

  @Prop({ type: PageSettingsSchema, default: () => ({}) })
  settings!: PageSettings;

  @Prop({
    type: [
      {
        _id: false,
        id: { type: String, required: true },
        type: { type: String, enum: Object.values(PageBlockType), required: true },
        visible: { type: Boolean, default: true },
        style: { type: MongooseSchema.Types.Mixed, default: {} },
        data: { type: MongooseSchema.Types.Mixed, default: {} },
      },
    ],
    default: [],
  })
  blocks!: PageBlock[];

  /**
   * Uploaded files the page references, recomputed on every save. Lets the
   * service delete images a page stopped using without deleting ones a
   * duplicated page still shows.
   */
  @Prop({ type: [String], default: [], select: false })
  assets!: string[];
}

export const PageSchema = SchemaFactory.createForClass(Page);
