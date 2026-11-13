import { LocalizedField } from "../globalTypes";

export type Banner = {
    _id: string;
    image?: string;
    /** Optional phone version of `image`. */
    mobileImage?: string;
    /** Seconds, when `image` is a video (max 30). */
    duration?: number;
    /** Seconds, when `mobileImage` is a video (max 30). */
    mobileDuration?: number;
    title: LocalizedField;
    description?: LocalizedField;
    active: boolean;
    weight?: number;
};
