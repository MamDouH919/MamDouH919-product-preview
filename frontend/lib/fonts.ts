import { Cairo } from "next/font/google";

/**
 * The site's one font. Loaded here only: every call to a next/font function
 * is its own copy of the font, and it used to be called in three files.
 * No `weight`: the variable font covers every weight in one file per script,
 * instead of six files.
 */
export const cairo = Cairo({
  subsets: ["arabic", "latin"],
  display: "swap",
  variable: "--font-cairo",
});
