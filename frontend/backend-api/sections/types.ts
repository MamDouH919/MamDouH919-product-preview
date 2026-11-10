import { LocalizedField } from "../globalTypes";

export type SectionType = 'DEFAULT' | 'HIGHLIGHTS' | 'GALLERY' | 'LINKS' | 'FAQ';

export type HighlightItem = {
  key?: LocalizedField;
  value: string;
  image?: string;
};

/** Plain text both: also published as FAQPage structured data. */
export type FaqItem = {
  question?: LocalizedField;
  answer?: LocalizedField;
};

export type Section = {
  _id: string;
  sectionName: string;
  title?: LocalizedField;
  description?: LocalizedField;
  image?: string;
  type?: SectionType;
  active?: boolean;
  highlights?: HighlightItem[];
  gallery?: string[];
  links?: { label?: LocalizedField; url: string }[];
  faqs?: FaqItem[];
};

/** Sections the storefront home page renders, by the `sectionName` it looks them up with. */
export const HOME_SECTIONS: { name: string; type: SectionType }[] = [
  { name: 'home-story', type: 'DEFAULT' },
  { name: 'home-stats', type: 'HIGHLIGHTS' },
  { name: 'home-gallery', type: 'GALLERY' },
  { name: 'home-cta', type: 'LINKS' },
  { name: 'home-faq', type: 'FAQ' },
];
