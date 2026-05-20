import { LocalizedField } from "../globalTypes";

export type Banner = {
    _id: string;
    image?: string;
    title: LocalizedField;
    description?: LocalizedField;
    active: boolean;
    weight?: number;
};
