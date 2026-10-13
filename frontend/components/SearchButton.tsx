"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Dialog, IconButton, InputAdornment, TextField, Tooltip } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";

/** Header search: opens a field and sends the query to the products page. */
const SearchButton = () => {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    setOpen(false);
    router.push(`/${i18n.language}/products${term ? `?q=${encodeURIComponent(term)}` : ""}`);
  };

  return (
    <>
      <Tooltip title={t("search")}>
        <IconButton onClick={() => setOpen(true)} aria-label={t("search")}>
          <SearchIcon />
        </IconButton>
      </Tooltip>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="sm"
        slotProps={{ paper: { sx: { position: "absolute", top: 72, m: 2, borderRadius: 3 } } }}
      >
        <form onSubmit={submit}>
          <TextField
            autoFocus
            fullWidth
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("searchProductsPlaceholder")}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
                sx: { py: 0.5, "& fieldset": { border: "none" } },
              },
              htmlInput: { enterKeyHint: "search", maxLength: 100 },
            }}
          />
        </form>
      </Dialog>
    </>
  );
};

export default SearchButton;
