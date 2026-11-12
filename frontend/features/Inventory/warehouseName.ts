import { LocalizedField } from "@/backend-api/globalTypes";

/** A warehouse's name in the reader's language, falling back to the other one, then its code. */
export const warehouseName = (w: { name?: LocalizedField; code?: string } | undefined, lang: string) =>
  (w?.name?.[lang as keyof LocalizedField] ?? w?.name?.ar ?? w?.name?.en ?? w?.code ?? "") as string;
