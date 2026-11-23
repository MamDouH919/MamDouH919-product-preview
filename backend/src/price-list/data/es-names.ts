/**
 * Spanish names for the places in the seed data. Zones are keyed by their
 * ISO 3166-2 code; subzones by their English name — most keep it (a Spanish
 * speaker writes "Nasr City" or "Austin" as is), so only the ones with their
 * own Spanish name are listed and the rest fall back to English.
 */
export const ZONE_NAMES_ES: Record<string, string> = {
  // Egypt
  'EG-C': 'El Cairo', 'EG-GZ': 'Guiza', 'EG-ALX': 'Alejandría', 'EG-KB': 'Qalyubia', 'EG-SHR': 'Sharqia',
  'EG-DK': 'Dakahlia', 'EG-GH': 'Gharbia', 'EG-MNF': 'Menufia', 'EG-BH': 'Beheira', 'EG-KFS': 'Kafr el-Sheij',
  'EG-DT': 'Damieta', 'EG-PTS': 'Port Saíd', 'EG-IS': 'Ismailía', 'EG-SUZ': 'Suez', 'EG-FYM': 'El Fayún',
  'EG-BNS': 'Beni Suef', 'EG-MN': 'Minya', 'EG-AST': 'Asiut', 'EG-SHG': 'Sohag', 'EG-KN': 'Qena',
  'EG-LX': 'Luxor', 'EG-ASN': 'Asuán', 'EG-BA': 'Mar Rojo', 'EG-WAD': 'Nuevo Valle', 'EG-MT': 'Marsa Matruh',
  'EG-SIN': 'Sinaí del Norte', 'EG-JS': 'Sinaí del Sur',
  // United States
  'US-AL': 'Alabama', 'US-AK': 'Alaska', 'US-AZ': 'Arizona', 'US-AR': 'Arkansas', 'US-CA': 'California',
  'US-CO': 'Colorado', 'US-CT': 'Connecticut', 'US-DE': 'Delaware', 'US-DC': 'Washington D. C.', 'US-FL': 'Florida',
  'US-GA': 'Georgia', 'US-HI': 'Hawái', 'US-ID': 'Idaho', 'US-IL': 'Illinois', 'US-IN': 'Indiana', 'US-IA': 'Iowa',
  'US-KS': 'Kansas', 'US-KY': 'Kentucky', 'US-LA': 'Luisiana', 'US-ME': 'Maine', 'US-MD': 'Maryland',
  'US-MA': 'Massachusetts', 'US-MI': 'Míchigan', 'US-MN': 'Minnesota', 'US-MS': 'Misisipi', 'US-MO': 'Misuri',
  'US-MT': 'Montana', 'US-NE': 'Nebraska', 'US-NV': 'Nevada', 'US-NH': 'Nuevo Hampshire', 'US-NJ': 'Nueva Jersey',
  'US-NM': 'Nuevo México', 'US-NY': 'Nueva York', 'US-NC': 'Carolina del Norte', 'US-ND': 'Dakota del Norte',
  'US-OH': 'Ohio', 'US-OK': 'Oklahoma', 'US-OR': 'Oregón', 'US-PA': 'Pensilvania', 'US-RI': 'Rhode Island',
  'US-SC': 'Carolina del Sur', 'US-SD': 'Dakota del Sur', 'US-TN': 'Tennessee', 'US-TX': 'Texas', 'US-UT': 'Utah',
  'US-VT': 'Vermont', 'US-VA': 'Virginia', 'US-WA': 'Washington', 'US-WV': 'Virginia Occidental',
  'US-WI': 'Wisconsin', 'US-WY': 'Wyoming',
};

/** Subzones with a Spanish name of their own, by English name; everything else keeps its English name. */
export const SUBZONE_NAMES_ES: Record<string, string> = {
  // Egypt
  Cairo: 'El Cairo', Alexandria: 'Alejandría', Giza: 'Guiza', Luxor: 'Luxor', Aswan: 'Asuán', Suez: 'Suez',
  'Port Said': 'Port Saíd', Damietta: 'Damieta', Ismailia: 'Ismailía', Faiyum: 'El Fayún', Heliopolis: 'Heliópolis',
  'New Cairo': 'Nuevo Cairo', 'New Administrative Capital': 'Nueva Capital Administrativa', Sharm: 'Sharm el-Sheij',
  'Sharm El Sheikh': 'Sharm el-Sheij', Hurghada: 'Hurgada', 'Marsa Alam': 'Marsa Alam', 'El Alamein': 'El Alamein',
  // United States
  'Los Angeles': 'Los Ángeles', 'San Francisco': 'San Francisco', 'San Diego': 'San Diego', 'San Jose': 'San José',
  'New York City': 'Nueva York', 'New Orleans': 'Nueva Orleans', 'New Haven': 'Nuevo Haven',
  'Washington D.C.': 'Washington D. C.', 'Saint Paul': 'San Pablo', 'Salt Lake City': 'Salt Lake City',
  'Kansas City': 'Kansas City', 'Philadelphia': 'Filadelfia', 'Brooklyn': 'Brooklyn', 'Virginia Beach': 'Virginia Beach',
  Hilo: 'Hilo', Honolulu: 'Honolulu',
};

export const zoneNameEs = (code: string, english: string) => ZONE_NAMES_ES[code] ?? english;
export const subZoneNameEs = (english: string) => SUBZONE_NAMES_ES[english] ?? english;
