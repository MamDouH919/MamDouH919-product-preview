import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter, Types } from 'mongoose';
import { Address, Customer } from './schemas/customer.schema';
import { Product } from '../products/schemas/product.schema';
import {
  AddressDto,
  QueryCustomersDto,
  UpdateAddressDto,
  UpdateProfileDto,
} from './dto/customer.dto';

const WISHLIST_LIMIT = 200;

@Injectable()
export class CustomersService {
  constructor(
    @InjectModel(Customer.name) private customerModel: Model<Customer>,
    @InjectModel(Product.name) private productModel: Model<Product>,
  ) {}

  // ── Self-service ────────────────────────────────────────────────────────────

  async getProfile(customerId: string): Promise<Customer> {
    const customer = await this.customerModel
      .findById(customerId)
      .select('-password')
      .exec();
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async updateProfile(customerId: string, dto: UpdateProfileDto): Promise<Customer> {
    // Email is deliberately not updatable here — it is the login identity, and
    // changing it needs a verification round-trip this phase does not have.
    const customer = await this.customerModel
      .findByIdAndUpdate(customerId, dto, { returnDocument: 'after' })
      .select('-password')
      .exec();
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async getAddresses(customerId: string): Promise<Address[]> {
    const customer = await this.getProfile(customerId);
    return customer.addresses ?? [];
  }

  async addAddress(customerId: string, dto: AddressDto): Promise<Address[]> {
    const customer = await this.customerModel.findById(customerId).exec();
    if (!customer) throw new NotFoundException('Customer not found');

    // The first address a customer saves is their default whether they asked
    // for it or not — otherwise checkout has nothing to preselect.
    const isFirst = (customer.addresses?.length ?? 0) === 0;
    const shouldDefault = dto.isDefault || isFirst;

    if (shouldDefault) this.clearDefaults(customer);

    customer.addresses.push({ ...dto, isDefault: shouldDefault } as Address);
    await customer.save();

    return customer.addresses;
  }

  async updateAddress(
    customerId: string,
    addressId: string,
    dto: UpdateAddressDto,
  ): Promise<Address[]> {
    const customer = await this.customerModel.findById(customerId).exec();
    if (!customer) throw new NotFoundException('Customer not found');

    const address = customer.addresses.find((a) => a._id.toString() === addressId);
    if (!address) throw new NotFoundException('Address not found');

    if (dto.isDefault) this.clearDefaults(customer);

    Object.assign(address, dto);
    // Never let the customer end up with no default by unsetting the only one.
    if (!customer.addresses.some((a) => a.isDefault) && customer.addresses.length) {
      customer.addresses[0].isDefault = true;
    }

    await customer.save();
    return customer.addresses;
  }

  async removeAddress(customerId: string, addressId: string): Promise<Address[]> {
    const customer = await this.customerModel.findById(customerId).exec();
    if (!customer) throw new NotFoundException('Customer not found');

    const index = customer.addresses.findIndex((a) => a._id.toString() === addressId);
    if (index === -1) throw new NotFoundException('Address not found');

    const wasDefault = customer.addresses[index].isDefault;
    customer.addresses.splice(index, 1);

    if (wasDefault && customer.addresses.length) {
      customer.addresses[0].isDefault = true;
    }

    await customer.save();
    return customer.addresses;
  }

  async setDefaultAddress(customerId: string, addressId: string): Promise<Address[]> {
    const customer = await this.customerModel.findById(customerId).exec();
    if (!customer) throw new NotFoundException('Customer not found');

    const address = customer.addresses.find((a) => a._id.toString() === addressId);
    if (!address) throw new NotFoundException('Address not found');

    this.clearDefaults(customer);
    address.isDefault = true;

    await customer.save();
    return customer.addresses;
  }

  // ── Wishlist ────────────────────────────────────────────────────────────────

  /**
   * Saved products that can still be shown. Hidden or deleted products drop
   * out of the list rather than appearing as broken cards; their ids stay, so
   * a product that comes back reappears.
   */
  async getWishlist(customerId: string): Promise<Product[]> {
    const customer = await this.customerModel.findById(customerId).select('wishlist').exec();
    if (!customer) throw new NotFoundException('Customer not found');

    const saved = customer.wishlist ?? [];
    const products = await this.productModel
      .find({ _id: { $in: saved }, isActive: true })
      .select('-description')
      .populate('category', 'name slug')
      .exec();

    // Newest saves first.
    const position = new Map(saved.map((id, i) => [id.toString(), i]));
    return products.sort(
      (a, b) => position.get(b._id!.toString())! - position.get(a._id!.toString())!,
    );
  }

  async addToWishlist(customerId: string, productId: string): Promise<string[]> {
    if (!Types.ObjectId.isValid(productId)) throw new NotFoundException('Product not found');
    const exists = await this.productModel.exists({ _id: productId, isActive: true });
    if (!exists) throw new NotFoundException('Product not found');

    // Conditional on size so a script can't grow the document without bound.
    const customer = await this.customerModel
      .findOneAndUpdate(
        {
          _id: customerId,
          // `$ifNull`: customers created before wishlists have no field yet.
          $expr: { $lt: [{ $size: { $ifNull: ['$wishlist', []] } }, WISHLIST_LIMIT] },
        },
        { $addToSet: { wishlist: new Types.ObjectId(productId) } },
        { returnDocument: 'after' },
      )
      .select('wishlist')
      .exec();
    if (!customer) {
      throw new BadRequestException(`Your wishlist is full (${WISHLIST_LIMIT} items).`);
    }
    return customer.wishlist.map(String);
  }

  async removeFromWishlist(customerId: string, productId: string): Promise<string[]> {
    if (!Types.ObjectId.isValid(productId)) throw new NotFoundException('Product not found');
    const customer = await this.customerModel
      .findByIdAndUpdate(
        customerId,
        { $pull: { wishlist: new Types.ObjectId(productId) } },
        { returnDocument: 'after' },
      )
      .select('wishlist')
      .exec();
    if (!customer) throw new NotFoundException('Customer not found');
    return customer.wishlist.map(String);
  }

  // ── Admin ───────────────────────────────────────────────────────────────────

  async findAll(query: QueryCustomersDto): Promise<{
    data: Customer[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;

    const filter: QueryFilter<Customer> = {};
    if (query.search) {
      const term = new RegExp(this.escapeRegex(query.search), 'i');
      filter.$or = [{ name: term }, { email: term }, { phone: term }];
    }

    const [data, total] = await Promise.all([
      this.customerModel
        .find(filter)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.customerModel.countDocuments(filter).exec(),
    ]);

    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<Customer> {
    const customer = await this.customerModel
      .findById(id)
      .select('-password')
      .exec();
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  /** Blocks or restores an account without touching its order history. */
  async setActive(id: string, isActive: boolean): Promise<Customer> {
    const customer = await this.customerModel
      .findByIdAndUpdate(id, { isActive }, { returnDocument: 'after' })
      .select('-password')
      .exec();
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  /** The address an order should preselect, if the customer has saved one. */
  async getDefaultAddress(customerId: string): Promise<Address | undefined> {
    const customer = await this.getProfile(customerId);
    return customer.addresses?.find((a) => a.isDefault) ?? customer.addresses?.[0];
  }

  /** Looks up one address for order placement — the id must belong to the customer. */
  async getAddress(customerId: string, addressId: string): Promise<Address> {
    const customer = await this.getProfile(customerId);
    const address = customer.addresses?.find(
      (a) => a._id.toString() === addressId,
    );
    if (!address) throw new NotFoundException('Address not found');
    return address;
  }

  private clearDefaults(customer: Customer): void {
    customer.addresses.forEach((a) => {
      a.isDefault = false;
    });
  }

  private escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
