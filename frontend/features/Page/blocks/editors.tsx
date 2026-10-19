"use client";

import { useTranslation } from "react-i18next";
import {
  Autocomplete,
  Box,
  FormControlLabel,
  Slider,
  Switch,
  TextField,
  Typography,
  createFilterOptions,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { iconNames, iconsMap } from "@/components/IconPicker";
import { useCategoriesQuery } from "@/backend-api/categories/hooks";
import { BlockStyle, PageBlock } from "@/backend-api/pages/types";
import { emptyL, Lang, loc } from "./registry";
import { toEmbedUrl } from "./renderers";
import {
  ButtonsField,
  ColorInput,
  ImageField,
  LRichText,
  LText,
  ListEditor,
  SelectInput,
  TextInput,
} from "./fields";

type EditorProps = {
  block: PageBlock;
  lang: Lang;
  /** Merges a patch into the block's data. */
  set: (patch: Record<string, any>) => void;
};

const filterIcons = createFilterOptions<string>({ limit: 60 });

function IconSelect({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  const { t } = useTranslation();
  const Selected = value ? iconsMap[value] : undefined;
  return (
    <Autocomplete
      size="small"
      options={iconNames}
      value={value || null}
      filterOptions={filterIcons}
      onChange={(_, v) => onChange(v ?? "")}
      renderOption={(props, option) => {
        const Icon = iconsMap[option];
        const { key, ...rest } = props as any;
        return (
          <Box component="li" key={key} {...rest} sx={{ display: "flex", gap: 1.5 }}>
            {Icon && <Icon size={18} />}
            {option}
          </Box>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={t("icon")}
          slotProps={{
            input: {
              ...params.InputProps,
              startAdornment: Selected ? (
                <Box sx={{ display: "flex", px: 0.5 }}>
                  <Selected size={18} />
                </Box>
              ) : undefined,
            },
          }}
        />
      )}
    />
  );
}

function HeroEditor({ block, lang, set }: EditorProps) {
  const { t } = useTranslation();
  const d = block.data;
  return (
    <>
      <ImageField label={t("backgroundImage")} value={d.image} onChange={(image) => set({ image })} />
      <LText label={t("title")} value={d.title} onChange={(title) => set({ title })} lang={lang} />
      <LText label={t("subtitle")} value={d.subtitle} onChange={(subtitle) => set({ subtitle })} lang={lang} multiline />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <SelectInput
            label={t("height")}
            value={d.height ?? "md"}
            onChange={(height) => set({ height })}
            options={[
              { value: "sm", label: t("sizeSmall") },
              { value: "md", label: t("sizeMedium") },
              { value: "lg", label: t("sizeLarge") },
              { value: "screen", label: t("sizeFullScreen") },
            ]}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Typography variant="caption" color="text.secondary">
            {t("overlayDarkness")}: {d.overlay ?? 45}%
          </Typography>
          <Slider
            size="small"
            min={0}
            max={90}
            step={5}
            value={Number(d.overlay ?? 45)}
            onChange={(_, v) => set({ overlay: v as number })}
          />
        </Grid>
      </Grid>
      <ButtonsField value={d.buttons} onChange={(buttons) => set({ buttons })} lang={lang} />
    </>
  );
}

function RichTextEditor({ block, lang, set }: EditorProps) {
  const { t } = useTranslation();
  return (
    <LRichText label={t("content")} value={block.data.content} onChange={(content) => set({ content })} lang={lang} />
  );
}

function ImageEditor({ block, lang, set }: EditorProps) {
  const { t } = useTranslation();
  const d = block.data;
  return (
    <>
      <ImageField value={d.image} onChange={(image) => set({ image })} height={200} />
      <LText label={t("altText")} value={d.alt} onChange={(alt) => set({ alt })} lang={lang} />
      <LText label={t("caption")} value={d.caption} onChange={(caption) => set({ caption })} lang={lang} />
      <TextInput label={t("link")} value={d.link} onChange={(link) => set({ link })} helperText={t("linkHelp")} />
      <FormControlLabel
        control={<Switch checked={!!d.rounded} onChange={(e) => set({ rounded: e.target.checked })} />}
        label={t("roundedCorners")}
      />
    </>
  );
}

function ImageTextEditor({ block, lang, set }: EditorProps) {
  const { t } = useTranslation();
  const d = block.data;
  return (
    <>
      <ImageField value={d.image} onChange={(image) => set({ image })} />
      <SelectInput
        label={t("imagePosition")}
        value={d.imagePosition ?? "start"}
        onChange={(imagePosition) => set({ imagePosition })}
        options={[
          { value: "start", label: t("positionStart") },
          { value: "end", label: t("positionEnd") },
        ]}
      />
      <LText label={t("title")} value={d.title} onChange={(title) => set({ title })} lang={lang} />
      <LRichText label={t("content")} value={d.content} onChange={(content) => set({ content })} lang={lang} />
      <ButtonsField value={d.buttons} onChange={(buttons) => set({ buttons })} lang={lang} max={2} />
    </>
  );
}

const COLUMN_OPTIONS = [2, 3, 4].map((n) => ({ value: n, label: String(n) }));

function GalleryEditor({ block, lang, set }: EditorProps) {
  const { t } = useTranslation();
  const d = block.data;
  return (
    <>
      <LText label={t("title")} value={d.title} onChange={(title) => set({ title })} lang={lang} />
      <SelectInput label={t("columns")} value={Number(d.columns ?? 3)} onChange={(columns) => set({ columns })} options={COLUMN_OPTIONS} />
      <ListEditor
        label={t("images")}
        items={d.images ?? []}
        onChange={(images) => set({ images })}
        createItem={() => ({ image: "", caption: emptyL() })}
        renderItem={(item: any, update) => (
          <>
            <ImageField value={item.image} onChange={(image) => update({ image })} height={120} />
            <LText label={t("caption")} value={item.caption} onChange={(caption) => update({ caption })} lang={lang} />
          </>
        )}
      />
    </>
  );
}

function FeaturesEditor({ block, lang, set }: EditorProps) {
  const { t } = useTranslation();
  const d = block.data;
  return (
    <>
      <LText label={t("title")} value={d.title} onChange={(title) => set({ title })} lang={lang} />
      <LText label={t("subtitle")} value={d.subtitle} onChange={(subtitle) => set({ subtitle })} lang={lang} />
      <SelectInput label={t("columns")} value={Number(d.columns ?? 3)} onChange={(columns) => set({ columns })} options={COLUMN_OPTIONS} />
      <ListEditor
        label={t("blockItems")}
        items={d.items ?? []}
        onChange={(items) => set({ items })}
        createItem={() => ({ icon: "Star", title: emptyL(), description: emptyL() })}
        renderItem={(item: any, update) => (
          <>
            <IconSelect value={item.icon} onChange={(icon) => update({ icon })} />
            <LText label={t("title")} value={item.title} onChange={(title) => update({ title })} lang={lang} />
            <LText
              label={t("description")}
              value={item.description}
              onChange={(description) => update({ description })}
              lang={lang}
              multiline
            />
          </>
        )}
      />
    </>
  );
}

function StatsEditor({ block, lang, set }: EditorProps) {
  const { t } = useTranslation();
  const d = block.data;
  return (
    <>
      <LText label={t("title")} value={d.title} onChange={(title) => set({ title })} lang={lang} />
      <ListEditor
        label={t("blockItems")}
        items={d.items ?? []}
        onChange={(items) => set({ items })}
        createItem={() => ({ value: "", label: emptyL() })}
        max={8}
        renderItem={(item: any, update) => (
          <>
            <TextInput label={t("value")} value={item.value} onChange={(value) => update({ value })} placeholder="500+" />
            <LText label={t("label")} value={item.label} onChange={(label) => update({ label })} lang={lang} />
          </>
        )}
      />
    </>
  );
}

function CtaEditor({ block, lang, set }: EditorProps) {
  const { t } = useTranslation();
  const d = block.data;
  return (
    <>
      <LText label={t("title")} value={d.title} onChange={(title) => set({ title })} lang={lang} />
      <LText label={t("text")} value={d.text} onChange={(text) => set({ text })} lang={lang} multiline />
      <Typography variant="caption" color="text.secondary">
        {t("ctaColorHint")}
      </Typography>
      <ButtonsField value={d.buttons} onChange={(buttons) => set({ buttons })} lang={lang} />
    </>
  );
}

function FaqEditor({ block, lang, set }: EditorProps) {
  const { t } = useTranslation();
  const d = block.data;
  return (
    <>
      <LText label={t("title")} value={d.title} onChange={(title) => set({ title })} lang={lang} />
      <ListEditor
        label={t("questions")}
        items={d.items ?? []}
        onChange={(items) => set({ items })}
        createItem={() => ({ question: emptyL(), answer: emptyL() })}
        renderItem={(item: any, update) => (
          <>
            <LText label={t("question")} value={item.question} onChange={(question) => update({ question })} lang={lang} />
            <LText label={t("answer")} value={item.answer} onChange={(answer) => update({ answer })} lang={lang} multiline />
          </>
        )}
      />
    </>
  );
}

function VideoEditor({ block, lang, set }: EditorProps) {
  const { t } = useTranslation();
  const d = block.data;
  const invalid = !!d.url && !toEmbedUrl(d.url);
  return (
    <>
      <LText label={t("title")} value={d.title} onChange={(title) => set({ title })} lang={lang} />
      <TextField
        size="small"
        fullWidth
        label={t("videoUrl")}
        value={d.url ?? ""}
        onChange={(e) => set({ url: e.target.value })}
        placeholder="https://www.youtube.com/watch?v=…"
        error={invalid}
        helperText={invalid ? t("videoUrlInvalid") : t("videoUrlHelp")}
      />
    </>
  );
}

function ButtonsEditor({ block, lang, set }: EditorProps) {
  return <ButtonsField value={block.data.buttons} onChange={(buttons) => set({ buttons })} lang={lang} max={6} />;
}

function ProductsEditor({ block, lang, set }: EditorProps) {
  const { t } = useTranslation();
  const d = block.data;
  const { data: categories } = useCategoriesQuery();
  return (
    <>
      <LText label={t("title")} value={d.title} onChange={(title) => set({ title })} lang={lang} />
      <SelectInput
        label={t("category")}
        value={d.categoryId ?? ""}
        onChange={(categoryId) => set({ categoryId })}
        options={[
          { value: "", label: t("allCategories") },
          ...(categories ?? []).map((c) => ({ value: c._id, label: loc(c.name, lang) })),
        ]}
      />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <SelectInput
            label={t("sortBy")}
            value={d.sort ?? "featured"}
            onChange={(sort) => set({ sort })}
            options={[
              { value: "featured", label: t("sortFeatured") },
              { value: "newest", label: t("sortNewest") },
              { value: "price_asc", label: t("sortPriceAsc") },
              { value: "price_desc", label: t("sortPriceDesc") },
            ]}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextInput
            label={t("numberOfProducts")}
            type="number"
            value={d.limit ?? 8}
            onChange={(v) => set({ limit: Math.min(Math.max(Number(v) || 1, 1), 24) })}
          />
        </Grid>
      </Grid>
    </>
  );
}

function SpacerEditor({ block, set }: EditorProps) {
  const { t } = useTranslation();
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {t("height")}: {block.data.height ?? 48}px
      </Typography>
      <Slider
        size="small"
        min={8}
        max={400}
        step={8}
        value={Number(block.data.height ?? 48)}
        onChange={(_, v) => set({ height: v as number })}
      />
    </Box>
  );
}

function DividerEditor({ block, set }: EditorProps) {
  const { t } = useTranslation();
  return (
    <>
      <Box>
        <Typography variant="caption" color="text.secondary">
          {t("thickness")}: {block.data.thickness ?? 1}px
        </Typography>
        <Slider
          size="small"
          min={1}
          max={12}
          value={Number(block.data.thickness ?? 1)}
          onChange={(_, v) => set({ thickness: v as number })}
        />
      </Box>
      <ColorInput label={t("color")} value={block.data.color} onChange={(color) => set({ color })} />
    </>
  );
}

export const BLOCK_EDITORS: Record<PageBlock["type"], React.ComponentType<EditorProps>> = {
  hero: HeroEditor,
  richText: RichTextEditor,
  image: ImageEditor,
  imageText: ImageTextEditor,
  gallery: GalleryEditor,
  features: FeaturesEditor,
  stats: StatsEditor,
  cta: CtaEditor,
  faq: FaqEditor,
  video: VideoEditor,
  buttons: ButtonsEditor,
  products: ProductsEditor,
  spacer: SpacerEditor,
  divider: DividerEditor,
};

/** Presentation options shared by every block. */
export function StyleEditor({ style, onChange }: { style: BlockStyle; onChange: (s: BlockStyle) => void }) {
  const { t } = useTranslation();
  const set = (patch: Partial<BlockStyle>) => onChange({ ...style, ...patch });
  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, sm: 6 }}>
        <ColorInput label={t("backgroundColor")} value={style.backgroundColor} onChange={(backgroundColor) => set({ backgroundColor })} />
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <ColorInput label={t("textColor")} value={style.textColor} onChange={(textColor) => set({ textColor })} />
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <SelectInput
          label={t("verticalSpacing")}
          value={style.paddingY ?? "md"}
          onChange={(paddingY) => set({ paddingY })}
          options={[
            { value: "none", label: t("spacingNone") },
            { value: "sm", label: t("sizeSmall") },
            { value: "md", label: t("sizeMedium") },
            { value: "lg", label: t("sizeLarge") },
            { value: "xl", label: t("sizeExtraLarge") },
          ]}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <SelectInput
          label={t("contentWidth")}
          value={style.width ?? "inherit"}
          onChange={(width) => set({ width })}
          options={[
            { value: "inherit", label: t("widthPage") },
            { value: "sm", label: t("widthNarrow") },
            { value: "md", label: t("sizeMedium") },
            { value: "lg", label: t("widthWide") },
            { value: "xl", label: t("widthExtraWide") },
            { value: "full", label: t("widthFull") },
          ]}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <SelectInput
          label={t("alignment")}
          value={style.align ?? "start"}
          onChange={(align) => set({ align })}
          options={[
            { value: "start", label: t("positionStart") },
            { value: "center", label: t("positionCenter") },
            { value: "end", label: t("positionEnd") },
          ]}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <TextInput
          label={t("anchorId")}
          value={style.anchor}
          onChange={(anchor) => set({ anchor })}
          placeholder="about"
          helperText={t("anchorHelp")}
        />
      </Grid>
    </Grid>
  );
}
