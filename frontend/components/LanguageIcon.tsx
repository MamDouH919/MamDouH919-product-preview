import { IconButton, Menu, MenuItem } from "@mui/material";
import { Globe } from "lucide-react";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { INTERFACE_LOCALES, useStoreLocales } from "@/lib/storeLocalesContext";
import type { Locale } from "@/lib/locales";

const LABELS: Record<Locale, string> = {
  ar: "العربية",
  en: "English",
};

type Props = {
  /**
   * "site": the languages the store is published in, hidden when there is
   * only one. "dashboard": every language the interface has, so staff can
   * run a store in a language they don't read.
   */
  scope?: "site" | "dashboard";
};

const LanguageIcon = ({ scope = "site" }: Props) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { languages, defaultLanguage } = useStoreLocales();
  const options = scope === "dashboard" ? INTERFACE_LOCALES : languages;

  const currentLang = pathname.split("/")[1] || defaultLanguage;

  const handleOpen = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
  const handleClose = () => setAnchorEl(null);

  const switchLanguage = (lang: string) => {
    const segments = pathname.split("/");
    segments[1] = lang;
    router.push(segments.join("/") || "/");
    handleClose();
  };

  if (options.length < 2) return null;

  return (
    <>
      <IconButton
        aria-label="Language"
        onClick={handleOpen}
        size="small"
        color="primary"
      >
        <Globe />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        sx={{ "& .MuiMenu-list": { minWidth: 130 } }}
      >
        {options.map((code) => ({ code, label: LABELS[code] })).map(({ code, label }) => (
          <MenuItem
            key={code}
            onClick={() => switchLanguage(code)}
            selected={currentLang === code}
            sx={{
              fontWeight: currentLang === code ? 700 : 400,
              color: currentLang === code ? "primary.main" : "inherit",
            }}
          >
            {label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

export default LanguageIcon;
