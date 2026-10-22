import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter, Types } from 'mongoose';
import { Zone, SubZone } from './schemas/zone.schema';
import { DeliveryPrice } from './schemas/delivery-price.schema';
import { Setting } from '../settings/schemas/setting.schema';
import { LocalizedField } from '../common/schemas/localized-field.schema';
import { COUNTRY_ZONES, subZoneCode } from './data';
import {
  CreateDeliveryPriceDto,
  QueryDeliveryPricesDto,
  SetFlatPriceDto,
  SetZonePriceDto,
  UpdateDeliveryPriceDto,
} from './dto/price-list.dto';

/** Where an order ships and what that costs, as checkout needs it. */
export interface ResolvedDelivery {
  zone: Types.ObjectId;
  subZone: Types.ObjectId;
  zoneName: LocalizedField;
  subZoneName: LocalizedField;
  price: number;
}

/** A zone with the subzones the store delivers to, for the storefront pickers. */
export interface DeliveryArea {
  _id: Types.ObjectId;
  name: LocalizedField;
  subZones: { _id: Types.ObjectId; name: LocalizedField; price: number }[];
}

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

@Injectable()
export class PriceListService {
  constructor(
    @InjectModel(Zone.name) private zoneModel: Model<Zone>,
    @InjectModel(SubZone.name) private subZoneModel: Model<SubZone>,
    @InjectModel(DeliveryPrice.name) private priceModel: Model<DeliveryPrice>,
    @InjectModel(Setting.name) private settingModel: Model<Setting>,
  ) {}

  // ── Seeding ─────────────────────────────────────────────────────────────────

  /**
   * Writes a country's zones and subzones. Upserts on their codes, so running
   * it again only corrects names — it never duplicates a place or touches the
   * prices already set for it.
   */
  async seedCountry(country: string): Promise<void> {
    const zones = COUNTRY_ZONES[country];
    if (!zones) throw new BadRequestException(`Unsupported country "${country}"`);

    await this.zoneModel.bulkWrite(
      zones.map((zone, sort) => ({
        updateOne: {
          filter: { code: zone.code },
          update: { $set: { country, name: zone.name, sort } },
          upsert: true,
        },
      })),
    );

    const ids = new Map(
      (await this.zoneModel.find({ country }).select('code').exec()).map((z) => [z.code, z._id]),
    );

    await this.subZoneModel.bulkWrite(
      zones.flatMap((zone) =>
        zone.subZones.map(([ar, en], sort) => ({
          updateOne: {
            filter: { code: subZoneCode(zone.code, en) },
            update: { $set: { zone: ids.get(zone.code), name: { ar, en }, sort } },
            upsert: true,
          },
        })),
      ),
    );
  }

  /** Whether a country's places are already in this store's database. */
  async isSeeded(country: string): Promise<boolean> {
    return !!(await this.zoneModel.exists({ country }));
  }

  // ── Storefront ──────────────────────────────────────────────────────────────

  /** Every place the store delivers to right now, grouped by zone. */
  async deliveryAreas(): Promise<DeliveryArea[]> {
    const { country, flatDeliveryPrice } = await this.deliverySettings();
    if (!country) return [];

    const zones = await this.zoneModel.find({ country }).sort({ sort: 1 }).exec();

    // A flat price opens every area of the country, whatever the price list says.
    if (flatDeliveryPrice != null) {
      const subZones = await this.subZoneModel
        .find({ zone: { $in: zones.map((z) => z._id) } })
        .sort({ sort: 1 })
        .select('zone name')
        .exec();
      return zones
        .map((zone) => ({
          _id: zone._id as Types.ObjectId,
          name: zone.name,
          subZones: subZones
            .filter((s) => s.zone.equals(zone._id as Types.ObjectId))
            .map((s) => ({ _id: s._id as Types.ObjectId, name: s.name, price: flatDeliveryPrice })),
        }))
        .filter((zone) => zone.subZones.length > 0);
    }

    const prices = await this.priceModel
      .find({ isActive: true, zone: { $in: zones.map((z) => z._id) } })
      .populate<{ subZone: SubZone }>('subZone', 'name sort')
      .exec();

    return zones
      .map((zone) => ({
        _id: zone._id as Types.ObjectId,
        name: zone.name,
        subZones: prices
          .filter((p) => p.subZone && p.zone.equals(zone._id as Types.ObjectId))
          .sort((a, b) => a.subZone.sort - b.subZone.sort)
          .map((p) => ({
            _id: p.subZone._id as Types.ObjectId,
            name: p.subZone.name,
            price: p.price,
          })),
      }))
      .filter((zone) => zone.subZones.length > 0);
  }

  /**
   * What delivering to a subzone costs, or null when the store doesn't deliver
   * there (no price, switched off, or it belongs to another country).
   */
  async resolve(subZoneId: string | Types.ObjectId | undefined): Promise<ResolvedDelivery | null> {
    if (!subZoneId || !Types.ObjectId.isValid(subZoneId)) return null;

    const { country, flatDeliveryPrice } = await this.deliverySettings();
    if (flatDeliveryPrice != null) {
      const subZone = await this.subZoneModel
        .findById(subZoneId)
        .populate<{ zone: Zone }>('zone', 'name country')
        .exec();
      if (!subZone?.zone || subZone.zone.country !== country) return null;
      return {
        zone: subZone.zone._id as Types.ObjectId,
        subZone: subZone._id as Types.ObjectId,
        zoneName: subZone.zone.name,
        subZoneName: subZone.name,
        price: flatDeliveryPrice,
      };
    }

    const price = await this.priceModel
      .findOne({ subZone: new Types.ObjectId(subZoneId), isActive: true })
      .populate<{ zone: Zone; subZone: SubZone }>([
        { path: 'zone', select: 'name country' },
        { path: 'subZone', select: 'name' },
      ])
      .exec();
    if (!price?.zone || !price.subZone) return null;
    if (price.zone.country !== country) return null;

    return {
      zone: price.zone._id as Types.ObjectId,
      subZone: price.subZone._id as Types.ObjectId,
      zoneName: price.zone.name,
      subZoneName: price.subZone.name,
      price: price.price,
    };
  }

  // ── Admin ───────────────────────────────────────────────────────────────────

  /** The selected country's zones with all their subzones, for the admin pickers. */
  async zones() {
    const country = await this.currentCountry();
    if (!country) return [];

    const zones = await this.zoneModel.find({ country }).sort({ sort: 1 }).lean().exec();
    const subZones = await this.subZoneModel
      .find({ zone: { $in: zones.map((z) => z._id) } })
      .sort({ sort: 1 })
      .select('zone name')
      .lean()
      .exec();

    return zones.map((zone) => ({
      _id: zone._id,
      code: zone.code,
      name: zone.name,
      subZones: subZones
        .filter((s) => s.zone.equals(zone._id))
        .map(({ _id, name }) => ({ _id, name })),
    }));
  }

  async findAll(query: QueryDeliveryPricesDto) {
    const country = await this.currentCountry();
    if (!country) return [];

    const zoneIds = (await this.zoneModel.find({ country }).select('_id').exec()).map((z) => z._id);
    const filter: QueryFilter<DeliveryPrice> = { zone: { $in: zoneIds } };
    if (query.zone) filter.zone = new Types.ObjectId(query.zone);
    if (query.search?.trim()) {
      const term = new RegExp(escapeRegex(query.search.trim()), 'i');
      const matches = await this.subZoneModel
        .find({ $or: [{ 'name.ar': term }, { 'name.en': term }] })
        .select('_id')
        .exec();
      filter.subZone = { $in: matches.map((s) => s._id) };
    }

    const rows = await this.priceModel
      .find(filter)
      .populate<{ zone: Zone; subZone: SubZone }>([
        { path: 'zone', select: 'name sort' },
        { path: 'subZone', select: 'name sort' },
      ])
      .exec();

    return rows
      .filter((row) => row.zone && row.subZone)
      .sort((a, b) => a.zone.sort - b.zone.sort || a.subZone.sort - b.subZone.sort);
  }

  /** Adds a row per subzone, all or nothing: an unknown or already-priced area rejects the lot. */
  async create(dto: CreateDeliveryPriceDto): Promise<{ created: number }> {
    const subZones = await this.subZoneModel.find({ _id: { $in: dto.subZoneIds } }).select('_id zone').exec();
    if (subZones.length !== dto.subZoneIds.length) throw new NotFoundException('Area not found');
    if (await this.priceModel.exists({ subZone: { $in: subZones.map((s) => s._id) } })) {
      throw new ConflictException('One of these areas already has a delivery price.');
    }
    await this.priceModel.insertMany(
      subZones.map((s) => ({
        zone: s.zone,
        subZone: s._id,
        price: dto.price,
        isActive: dto.isActive ?? true,
      })),
    );
    return { created: subZones.length };
  }

  /** The one price for every area, or null when each area is priced on its own. */
  async flatPrice(): Promise<{ price: number | null }> {
    return { price: (await this.deliverySettings()).flatDeliveryPrice ?? null };
  }

  async setFlatPrice(dto: SetFlatPriceDto): Promise<{ price: number | null }> {
    await this.settingModel.updateOne({}, { $set: { flatDeliveryPrice: dto.price } }, { upsert: true }).exec();
    return { price: dto.price };
  }

  /** Prices every subzone of a zone; rows that already exist take the new price. */
  async setZonePrice(dto: SetZonePriceDto): Promise<{ updated: number }> {
    const subZones = await this.subZoneModel.find({ zone: dto.zoneId }).select('_id zone').exec();
    if (!subZones.length) throw new NotFoundException('Zone not found');

    await this.priceModel.bulkWrite(
      subZones.map((s) => ({
        updateOne: {
          filter: { subZone: s._id },
          update: { $set: { zone: s.zone, price: dto.price }, $setOnInsert: { isActive: true } },
          upsert: true,
        },
      })),
    );
    return { updated: subZones.length };
  }

  async update(id: string, dto: UpdateDeliveryPriceDto): Promise<DeliveryPrice> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Price not found');
    const row = await this.priceModel
      .findByIdAndUpdate(id, dto, { returnDocument: 'after', runValidators: true })
      .exec();
    if (!row) throw new NotFoundException('Price not found');
    return row;
  }

  /** Orders keep their own copy of the fee, so deleting a row rewrites no history. */
  async remove(id: string): Promise<DeliveryPrice> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Price not found');
    const row = await this.priceModel.findByIdAndDelete(id).exec();
    if (!row) throw new NotFoundException('Price not found');
    return row;
  }

  private async currentCountry(): Promise<string | undefined> {
    return (await this.deliverySettings()).country;
  }

  private async deliverySettings(): Promise<{ country?: string; flatDeliveryPrice?: number | null }> {
    const settings = await this.settingModel.findOne().select('country flatDeliveryPrice').lean().exec();
    return { country: settings?.country, flatDeliveryPrice: settings?.flatDeliveryPrice };
  }
}
