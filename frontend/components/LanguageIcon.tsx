import { IconButton, Menu, MenuItem } from "@mui/material";
import { Globe } from "lucide-react";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const LANGUAGES = [
  { code: "ar", label: "العربية" },
  { code: "en", label: "English" },
];

const LanguageIcon = () => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  const currentLang = pathname.split("/")[1] || "ar";

  const handleOpen = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
  const handleClose = () => setAnchorEl(null);

  const switchLanguage = (lang: string) => {
    const segments = pathname.split("/");
    segments[1] = lang;
    router.push(segments.join("/") || "/");
    handleClose();
  };

  return (
    <>
      <IconButton
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
        {LANGUAGES.map(({ code, label }) => (
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
