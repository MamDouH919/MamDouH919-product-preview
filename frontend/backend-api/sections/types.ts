import { LocalizedField } from "../globalTypes";

export type SectionType = 'DEFAULT' | 'HIGHLIGHTS' | 'GALLERY' | 'LINKS';

export type HighlightItem = {
  key?: LocalizedField;
  value: string;
  image?: string;
};

export type Section = {
  _id: string;
  sectionName: string;
  title?: LocalizedField;
  description?: LocalizedField;
  image?: string;
  type?: SectionType;
  highlights?: HighlightItem[];
  gallery?: string[];
  links?: { label?: LocalizedField; url: string }[];
};
