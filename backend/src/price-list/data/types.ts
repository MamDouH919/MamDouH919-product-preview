export type SeedZone = {
  code: string;
  name: { ar: string; en: string };
  /** [Arabic, English] — the code is derived from the English name. */
  subZones: [string, string][];
};

export type CountryZones = SeedZone[];
