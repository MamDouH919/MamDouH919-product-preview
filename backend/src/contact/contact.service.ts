import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Contact } from './schemas/contact.schema';
import { CreateContactDto } from './dto/create-contact.dto';
import { MailService } from '../mail/mail.service';

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    @InjectModel(Contact.name) private contactModel: Model<Contact>,
    private mailService: MailService,
  ) {}

  async create(dto: CreateContactDto): Promise<Contact> {
    const message = new this.contactModel(dto);
    const saved = await message.save();

    // Notification is a courtesy, not part of the submission contract — a
    // mail outage should never fail the visitor's form submission.
    this.mailService.sendContactNotification(dto).catch((error) => {
      this.logger.error('Failed to send contact notification email', error);
    });

    return saved;
  }

  async findAll(): Promise<Contact[]> {
    return this.contactModel.find().sort({ createdAt: -1 }).exec();
  }

  async findOne(id: string): Promise<Contact | null> {
    return this.contactModel.findById(id).exec();
  }

  async markAsRead(id: string): Promise<Contact | null> {
    return this.contactModel
      .findByIdAndUpdate(id, { isRead: true }, { new: true })
      .exec();
  }

  async remove(id: string): Promise<void> {
    await this.contactModel.findByIdAndDelete(id).exec();
  }
}
