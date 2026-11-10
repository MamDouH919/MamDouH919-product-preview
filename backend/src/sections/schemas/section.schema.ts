import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { LocalizedField, LocalizedFieldSchema } from '../../common/schemas/localized-field.schema';

export enum SectionType {
  DEFAULT = 'DEFAULT',
  HIGHLIGHTS = 'HIGHLIGHTS',
  GALLERY = 'GALLERY',
  LINKS = 'LINKS',
  FAQ = 'FAQ',
}

/** A question and its answer, both plain text: the storefront also publishes them as FAQPage structured data. */
export class FaqItem {
  question!: LocalizedField;
  answer!: LocalizedField;
}

export class HighlightItem {
  key!: LocalizedField;
  value!: string;
  image?: string;
}

export class LinkItem {
  label!: LocalizedField;
  url!: string;
}

@Schema({ timestamps: true })
export class Section extends Document {
  @Prop({ required: true, unique: true })
  sectionName!: string;

  @Prop({ required: false, type: LocalizedFieldSchema })
  title?: LocalizedField;

  @Prop({ required: false, type: LocalizedFieldSchema })
  description?: LocalizedField;

  @Prop({ required: false })
  image?: string;

  @Prop({ enum: SectionType, default: SectionType.DEFAULT })
  type!: SectionType;

  @Prop({ default: true })
  active!: boolean;

  @Prop({
    type: [
      {
        key: { type: LocalizedFieldSchema },
        value: { type: String },
        image: { type: String, required: false },
      },
    ],
    default: [],
  })
  highlights!: HighlightItem[];

  @Prop({ required: false })
  gallery!: string[];

  @Prop({
    type: [
      {
        label: { type: LocalizedFieldSchema },
        url: { type: String },
      },
    ],
    default: [],
  })
  links!: LinkItem[];

  @Prop({
    type: [
      {
        question: { type: LocalizedFieldSchema },
        answer: { type: LocalizedFieldSchema },
      },
    ],
    default: [],
  })
  faqs!: FaqItem[];
}

export const SectionSchema = SchemaFactory.createForClass(Section);
