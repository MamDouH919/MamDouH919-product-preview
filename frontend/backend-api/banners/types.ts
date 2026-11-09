import { LocalizedField } from "../globalTypes";

export type Banner = {
    _id: string;
    image?: string;
    /** Optional phone version of `image`. */
    mobileImage?: string;
    title: LocalizedField;
    description?: LocalizedField;
    active: boolean;
    weight?: number;
};
