"use client";

import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { ArrowDown, ArrowUp, Plus, Trash2, Upload, X } from "lucide-react";
import Editor from "@/components/TextEditor";
import { LocalizedField } from "@/backend-api/globalTypes";
import { uploadPageImage } from "@/backend-api/pages/mutations";
import { getBackendUri, handleCompression } from "@/utils/helperFunctions";
import { ButtonItem, Lang, newButton } from "./registry";

/** Uploads an image for a page and returns its stored path. */
export async function uploadImage(file: File): Promise<string> {
  // GIFs lose their animation when re-encoded, so they go up untouched.
  const prepared: Blob = file.type === "image/gif" ? file : (await handleCompression(file)) ?? file;
  // The compressor hands back a Blob; multer needs a filename with an extension.
  const upload =
    prepared instanceof File && prepared.name
      ? prepared
      : new File([prepared], file.name.replace(/\.\w+$/, "") + ".webp", { type: prepared.type || "image/webp" });
  return uploadPageImage(upload);
}

/** Rich-text images are embedded as absolute URLs so they render on the storefront. */
const uploadEditorImage = async (file: File) => getBackendUri(await uploadImage(file));

// ── Localized inputs ─────────────────────────────────────────────────────────

export function LText({
  label,
  value,
  onChange,
  lang,
  multiline,
  placeholder,
}: {
  label: string;
  value?: LocalizedField;
  onChange: (v: LocalizedField) => void;
  lang: Lang;
  multiline?: boolean;
  placeholder?: string;
}) {
  return (
    <TextField
      size="small"
      fullWidth
      label={`${label} (${lang.toUpperCase()})`}
      value={value?.[lang] ?? ""}
      placeholder={placeholder}
      onChange={(e) => onChange({ ...(value ?? {}), [lang]: e.target.value })}
      multiline={multiline}
      minRows={multiline ? 3 : undefined}
      slotProps={{ htmlInput: { dir: lang === "ar" ? "rtl" : "ltr" } }}
    />
  );
}

export function LRichText({
  label,
  value,
  onChange,
  lang,
}: {
  label: string;
  value?: LocalizedField;
  onChange: (v: LocalizedField) => void;
  lang: Lang;
}) {
  return (
    <Stack spacing={1}>
      <Typography variant="caption" fontWeight={600} color="text.secondary">
        {label} ({lang.toUpperCase()})
      </Typography>
      {/* Keyed by language so the editor reloads its content on switch */}
      <Box dir={lang === "ar" ? "rtl" : "ltr"} key={lang}>
        <Editor
          value={value?.[lang] ?? ""}
          onChange={(html) => onChange({ ...(value ?? {}), [lang]: html })}
          onUploadImage={uploadEditorImage}
        />
      </Box>
    </Stack>
  );
}

// ── Plain inputs ─────────────────────────────────────────────────────────────

export function TextInput({
  label,
  value,
  onChange,
  placeholder,
  type,
  helperText,
}: {
  label: string;
  value?: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  helperText?: string;
}) {
  return (
    <TextField
      size="small"
      fullWidth
      label={label}
      type={type}
      value={value ?? ""}
      placeholder={placeholder}
      helperText={helperText}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function SelectInput<T extends string | number>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <TextField
      select
      size="small"
      fullWidth
      label={label}
      value={value}
      onChange={(e) => {
        const raw = e.target.value;
        onChange((typeof value === "number" ? Number(raw) : raw) as T);
      }}
    >
      {options.map((o) => (
        <MenuItem key={String(o.value)} value={o.value}>
          {o.label}
        </MenuItem>
      ))}
    </TextField>
  );
}

const HEX = /^#[0-9a-f]{6}$/i;

export function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: string;
  onChange: (v: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <TextField
      size="small"
      fullWidth
      label={label}
      value={value ?? ""}
      placeholder={t("pageDefault")}
      onChange={(e) => onChange(e.target.value)}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <Box
                component="input"
                type="color"
                value={value && HEX.test(value) ? value : "#ffffff"}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
                sx={{
                  width: 28,
                  height: 28,
                  p: 0,
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1,
                  cursor: "pointer",
                  bgcolor: "transparent",
                }}
              />
            </InputAdornment>
          ),
          endAdornment: value ? (
            <InputAdornment position="end">
              <IconButton size="small" onClick={() => onChange("")} aria-label={t("clear")}>
                <X size={16} />
              </IconButton>
            </InputAdornment>
          ) : undefined,
        },
      }}
    />
  );
}

// ── Image upload ─────────────────────────────────────────────────────────────

export function ImageField({
  label,
  value,
  onChange,
  height = 160,
}: {
  label?: string;
  value?: string;
  onChange: (path: string) => void;
  height?: number;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      onChange(await uploadImage(file));
    } catch {
      toast.error(t("somethingWentWrong"));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <Stack spacing={1}>
      {label && (
        <Typography variant="caption" fontWeight={600} color="text.secondary">
          {label}
        </Typography>
      )}
      <Box
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFile(e.dataTransfer.files?.[0]);
        }}
        sx={{
          position: "relative",
          height,
          borderRadius: 2,
          border: "2px dashed",
          borderColor: value ? "transparent" : "divider",
          bgcolor: "action.hover",
          overflow: "hidden",
          cursor: uploading ? "progress" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          "&:hover .image-actions": { opacity: 1 },
        }}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={getBackendUri(value)}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <Stack alignItems="center" spacing={1} color="text.secondary">
            <Upload size={26} />
            <Typography variant="body2">{t("uploadImagePrompt")}</Typography>
          </Stack>
        )}

        {value && !uploading && (
          <Stack
            className="image-actions"
            direction="row"
            spacing={1}
            sx={{
              position: "absolute",
              inset: 0,
              alignItems: "center",
              justifyContent: "center",
              bgcolor: "rgba(0,0,0,0.45)",
              opacity: 0,
              transition: "opacity .2s",
            }}
          >
            <Button size="small" variant="contained" color="inherit" startIcon={<Upload size={16} />}>
              {t("replace")}
            </Button>
            <Button
              size="small"
              variant="contained"
              color="error"
              startIcon={<Trash2 size={16} />}
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
            >
              {t("delete")}
            </Button>
          </Stack>
        )}

        {uploading && (
          <Stack
            sx={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", bgcolor: "rgba(255,255,255,0.7)" }}
          >
            <CircularProgress size={28} />
          </Stack>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
          hidden
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </Box>
    </Stack>
  );
}

// ── Repeatable lists ─────────────────────────────────────────────────────────

export function ListEditor<T>({
  label,
  items,
  onChange,
  createItem,
  renderItem,
  max,
}: {
  label: string;
  items: T[];
  onChange: (items: T[]) => void;
  createItem: () => T;
  renderItem: (item: T, update: (patch: Partial<T>) => void, index: number) => React.ReactNode;
  max?: number;
}) {
  const { t } = useTranslation();
  const list = items ?? [];

  const move = (from: number, to: number) => {
    if (to < 0 || to >= list.length) return;
    const next = [...list];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="subtitle2" fontWeight={700}>
          {label} <Typography component="span" variant="caption" color="text.secondary">({list.length})</Typography>
        </Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={<Plus size={16} />}
          disabled={max !== undefined && list.length >= max}
          onClick={() => onChange([...list, createItem()])}
        >
          {t("add")}
        </Button>
      </Stack>

      {list.map((item, index) => (
        <Paper key={index} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5}>
            <Typography variant="caption" fontWeight={700} color="text.secondary">
              #{index + 1}
            </Typography>
            <Stack direction="row">
              <Tooltip title={t("moveUp")}>
                <span>
                  <IconButton size="small" disabled={index === 0} onClick={() => move(index, index - 1)}>
                    <ArrowUp size={16} />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title={t("moveDown")}>
                <span>
                  <IconButton
                    size="small"
                    disabled={index === list.length - 1}
                    onClick={() => move(index, index + 1)}
                  >
                    <ArrowDown size={16} />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title={t("delete")}>
                <IconButton size="small" color="error" onClick={() => onChange(list.filter((_, i) => i !== index))}>
                  <Trash2 size={16} />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>
          <Stack spacing={1.5}>
            {renderItem(
              item,
              (patch) => onChange(list.map((it, i) => (i === index ? { ...it, ...patch } : it))),
              index,
            )}
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
}

export function ButtonsField({
  value,
  onChange,
  lang,
  max = 3,
}: {
  value?: ButtonItem[];
  onChange: (v: ButtonItem[]) => void;
  lang: Lang;
  max?: number;
}) {
  const { t } = useTranslation();
  return (
    <ListEditor<ButtonItem>
      label={t("buttons")}
      items={value ?? []}
      onChange={onChange}
      createItem={newButton}
      max={max}
      renderItem={(btn, update) => (
        <>
          <LText label={t("label")} value={btn.label} onChange={(label) => update({ label })} lang={lang} />
          <TextInput
            label={t("url")}
            value={btn.url}
            onChange={(url) => update({ url })}
            placeholder="/products  ·  https://…"
            helperText={t("linkHelp")}
          />
          <SelectInput
            label={t("buttonStyle")}
            value={btn.variant ?? "primary"}
            onChange={(variant) => update({ variant })}
            options={[
              { value: "primary", label: t("buttonPrimary") },
              { value: "outline", label: t("buttonOutline") },
              { value: "light", label: t("buttonLight") },
            ]}
          />
        </>
      )}
    />
  );
}
