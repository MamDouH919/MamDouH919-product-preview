"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Box,
  Button,
  ButtonBase,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Paper,
  Stack,
  Switch,
  Tab,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { alpha } from "@mui/material/styles";
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDown,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  GripVertical,
  Monitor,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Smartphone,
  Trash2,
} from "lucide-react";
import { createPage, updatePage } from "@/backend-api/pages/mutations";
import { PAGES_QUERY_KEY } from "@/backend-api/pages/hooks";
import { Page, PageBlock, PageBlockType, PagePayload } from "@/backend-api/pages/types";
import { LocalizedField } from "@/backend-api/globalTypes";
import { BLOCK_DEFINITIONS, BLOCKS_BY_TYPE, Lang, LANGS, blockSummary, createBlock, newBlockId } from "./blocks/registry";
import { BLOCK_EDITORS, StyleEditor } from "./blocks/editors";
import { ColorInput, ImageField, LText, SelectInput, TextInput } from "./blocks/fields";
import PageRenderer from "./PageRenderer";

// ── Helpers ──────────────────────────────────────────────────────────────────

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9؀-ۿ\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const toPayload = (page?: Page): PagePayload => ({
  slug: page?.slug ?? "",
  title: { ar: page?.title?.ar ?? "", en: page?.title?.en ?? "" },
  metaTitle: { ar: page?.metaTitle?.ar ?? "", en: page?.metaTitle?.en ?? "" },
  metaDescription: { ar: page?.metaDescription?.ar ?? "", en: page?.metaDescription?.en ?? "" },
  ogImage: page?.ogImage ?? "",
  isPublished: page?.isPublished ?? false,
  showInHeader: page?.showInHeader ?? false,
  showInFooter: page?.showInFooter ?? false,
  order: page?.order ?? 0,
  settings: {
    maxWidth: page?.settings?.maxWidth ?? "lg",
    backgroundColor: page?.settings?.backgroundColor ?? "",
    textColor: page?.settings?.textColor ?? "",
    showTitle: page?.settings?.showTitle ?? true,
  },
  blocks: (page?.blocks ?? []).map((b) => ({
    id: b.id,
    type: b.type,
    visible: b.visible !== false,
    style: b.style ?? {},
    data: b.data ?? {},
  })),
});

// ── Block picker ─────────────────────────────────────────────────────────────

function BlockPicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (type: PageBlockType) => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{t("addBlock")}</DialogTitle>
      <DialogContent>
        <Grid container spacing={1.5} pt={0.5}>
          {BLOCK_DEFINITIONS.map((def) => {
            const Icon = def.icon;
            return (
              <Grid key={def.type} size={{ xs: 12, sm: 6, md: 4 }}>
                <ButtonBase
                  onClick={() => onPick(def.type)}
                  sx={(theme) => ({
                    width: "100%",
                    height: "100%",
                    p: 2,
                    gap: 1.5,
                    borderRadius: 2,
                    border: 1,
                    borderColor: "divider",
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "flex-start",
                    textAlign: "start",
                    transition: "all .15s",
                    "&:hover": {
                      borderColor: "primary.main",
                      bgcolor: alpha(theme.palette.primary.main, 0.05),
                    },
                  })}
                >
                  <Box
                    sx={(theme) => ({
                      p: 1,
                      borderRadius: 1.5,
                      display: "flex",
                      color: "primary.main",
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                    })}
                  >
                    <Icon size={20} />
                  </Box>
                  <Box>
                    <Typography fontWeight={700} fontSize={14}>
                      {t(def.labelKey)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t(def.descriptionKey)}
                    </Typography>
                  </Box>
                </ButtonBase>
              </Grid>
            );
          })}
        </Grid>
      </DialogContent>
    </Dialog>
  );
}

// ── Block card ───────────────────────────────────────────────────────────────

function BlockCard({
  block,
  lang,
  expanded,
  onToggle,
  onChange,
  onDuplicate,
  onRemove,
  onInsertBelow,
}: {
  block: PageBlock;
  lang: Lang;
  expanded: boolean;
  onToggle: () => void;
  onChange: (block: PageBlock) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onInsertBelow: () => void;
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"content" | "style">("content");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });

  const def = BLOCKS_BY_TYPE[block.type];
  const Icon = def?.icon;
  const Editor = BLOCK_EDITORS[block.type];
  const summary = blockSummary(block, lang);

  return (
    <Paper
      ref={setNodeRef}
      id={`block-editor-${block.id}`}
      variant="outlined"
      sx={(theme) => ({
        borderRadius: 2,
        overflow: "hidden",
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 2 : undefined,
        position: "relative",
        boxShadow: isDragging ? theme.shadows[8] : undefined,
        borderColor: expanded ? "primary.main" : "divider",
        opacity: block.visible ? 1 : 0.6,
      })}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 1, py: 0.75 }}>
        <IconButton size="small" {...attributes} {...listeners} sx={{ cursor: "grab" }} aria-label={t("dragToReorder")}>
          <GripVertical size={18} />
        </IconButton>
        <ButtonBase
          onClick={onToggle}
          sx={{ flex: 1, minWidth: 0, justifyContent: "flex-start", gap: 1.25, py: 0.5, borderRadius: 1 }}
        >
          {Icon && (
            <Box sx={{ color: "primary.main", display: "flex" }}>
              <Icon size={18} />
            </Box>
          )}
          <Box sx={{ minWidth: 0, textAlign: "start" }}>
            <Typography fontWeight={700} fontSize={14} noWrap>
              {t(def?.labelKey ?? block.type)}
            </Typography>
            {summary && (
              <Typography variant="caption" color="text.secondary" noWrap component="div">
                {summary}
              </Typography>
            )}
          </Box>
          {!block.visible && <Chip size="small" label={t("hidden")} sx={{ ms: "auto" }} />}
        </ButtonBase>
        <Tooltip title={block.visible ? t("hideBlock") : t("showBlock")}>
          <IconButton size="small" onClick={() => onChange({ ...block, visible: !block.visible })}>
            {block.visible ? <Eye size={17} /> : <EyeOff size={17} />}
          </IconButton>
        </Tooltip>
        <Tooltip title={t("duplicate")}>
          <IconButton size="small" onClick={onDuplicate}>
            <Copy size={17} />
          </IconButton>
        </Tooltip>
        <Tooltip title={t("delete")}>
          <IconButton size="small" color="error" onClick={onRemove}>
            <Trash2 size={17} />
          </IconButton>
        </Tooltip>
        <IconButton size="small" onClick={onToggle} aria-expanded={expanded}>
          <ChevronDown size={18} style={{ transition: "transform .2s", transform: expanded ? "rotate(180deg)" : "none" }} />
        </IconButton>
      </Stack>

      <Collapse in={expanded} unmountOnExit>
        <Box sx={{ borderTop: 1, borderColor: "divider" }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="fullWidth" sx={{ minHeight: 40 }}>
            <Tab value="content" label={t("content")} sx={{ minHeight: 40 }} />
            <Tab value="style" label={t("design")} sx={{ minHeight: 40 }} />
          </Tabs>
          <Stack spacing={2} sx={{ p: 2 }}>
            {tab === "content" ? (
              Editor && (
                <Editor
                  block={block}
                  lang={lang}
                  set={(patch) => onChange({ ...block, data: { ...block.data, ...patch } })}
                />
              )
            ) : (
              <StyleEditor style={block.style ?? {}} onChange={(style) => onChange({ ...block, style })} />
            )}
            <Button size="small" startIcon={<Plus size={16} />} onClick={onInsertBelow} sx={{ alignSelf: "flex-start" }}>
              {t("addBlockBelow")}
            </Button>
          </Stack>
        </Box>
      </Collapse>
    </Paper>
  );
}

// ── Builder ──────────────────────────────────────────────────────────────────

interface PageBuilderProps {
  defaultData?: Page;
}

export default function PageBuilder({ defaultData }: PageBuilderProps) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isEditing = !!defaultData;

  const initial = useMemo(() => toPayload(defaultData), [defaultData]);
  const [draft, setDraft] = useState<PagePayload>(initial);
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(initial));
  const [slugTouched, setSlugTouched] = useState(isEditing);
  const [lang, setLang] = useState<Lang>((LANGS as readonly string[]).includes(i18n.language) ? (i18n.language as Lang) : "ar");
  const [panel, setPanel] = useState<"blocks" | "settings" | "seo">("blocks");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [picker, setPicker] = useState<{ open: boolean; index: number }>({ open: false, index: 0 });
  const [showPreview, setShowPreview] = useState(true);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [errors, setErrors] = useState<{ title?: boolean; slug?: boolean }>({});

  const isDirty = JSON.stringify(draft) !== savedSnapshot;

  // Warn before leaving the tab with unsaved work.
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const set = useCallback((patch: Partial<PagePayload>) => setDraft((d) => ({ ...d, ...patch })), []);

  const setTitle = (title: LocalizedField) => {
    setErrors((e) => ({ ...e, title: false }));
    setDraft((d) => ({
      ...d,
      title,
      slug: slugTouched ? d.slug : slugify(title.en || title.ar || ""),
    }));
  };

  // ── Block operations ──
  const setBlocks = (updater: (blocks: PageBlock[]) => PageBlock[]) =>
    setDraft((d) => ({ ...d, blocks: updater(d.blocks) }));

  const insertBlock = (type: PageBlockType) => {
    const block = createBlock(type);
    setBlocks((blocks) => {
      const next = [...blocks];
      next.splice(picker.index, 0, block);
      return next;
    });
    setPicker({ open: false, index: 0 });
    setExpandedId(block.id);
    setPanel("blocks");
    requestAnimationFrame(() =>
      document.getElementById(`block-editor-${block.id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
    );
  };

  const removeBlock = (index: number) => {
    const removed = draft.blocks[index];
    setBlocks((blocks) => blocks.filter((_, i) => i !== index));
    toast(t("blockDeleted"), {
      action: {
        label: t("undo"),
        onClick: () =>
          setBlocks((blocks) => {
            const next = [...blocks];
            next.splice(Math.min(index, next.length), 0, removed);
            return next;
          }),
      },
    });
  };

  const duplicateBlock = (index: number) => {
    const copy: PageBlock = JSON.parse(JSON.stringify(draft.blocks[index]));
    copy.id = newBlockId();
    setBlocks((blocks) => {
      const next = [...blocks];
      next.splice(index + 1, 0, copy);
      return next;
    });
    setExpandedId(copy.id);
  };

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setBlocks((blocks) => {
      const from = blocks.findIndex((b) => b.id === active.id);
      const to = blocks.findIndex((b) => b.id === over.id);
      return arrayMove(blocks, from, to);
    });
  };

  const selectFromPreview = (id: string) => {
    setPanel("blocks");
    setExpandedId(id);
    requestAnimationFrame(() =>
      document.getElementById(`block-editor-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };

  // ── Save ──
  const mutation = useMutation({
    mutationFn: (data: PagePayload) =>
      isEditing ? updatePage({ id: defaultData._id, data }) : createPage(data),
    onSuccess: (page, data) => {
      toast.success(t("saveSuccessfully"));
      setSavedSnapshot(JSON.stringify(data));
      queryClient.invalidateQueries({ queryKey: [PAGES_QUERY_KEY] });
      if (!isEditing) router.replace(`/${i18n.language}/admin/pages/${page._id}`);
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message;
      toast.error(typeof message === "string" ? message : t("somethingWentWrong"));
    },
  });

  const save = () => {
    const next = { title: !draft.title.ar && !draft.title.en, slug: !draft.slug };
    setErrors(next);
    if (next.title || next.slug) {
      setPanel("settings");
      toast.error(t("pageTitleSlugRequired"));
      return;
    }
    mutation.mutate(draft);
  };

  const publicUrl = `/${lang}/${draft.slug}`;

  // ── Render ──
  return (
    <Stack spacing={2} sx={{ minHeight: 0 }}>
      {/* Toolbar */}
      <Paper
        variant="outlined"
        sx={{ p: 1.5, borderRadius: 2, position: "sticky", top: 0, zIndex: 5 }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap" useFlexGap>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography fontWeight={800} noWrap>
              {draft.title[lang] || draft.title.ar || draft.title.en || t("untitledPage")}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                size="small"
                color={draft.isPublished ? "success" : "default"}
                label={draft.isPublished ? t("published") : t("draft")}
              />
              {isDirty && (
                <Typography variant="caption" color="warning.main" fontWeight={600}>
                  {t("unsavedChanges")}
                </Typography>
              )}
            </Stack>
          </Box>

          <Tooltip title={t("editingLanguage")}>
            <ToggleButtonGroup size="small" exclusive value={lang} onChange={(_, v) => v && setLang(v)}>
              {LANGS.map((l) => (
                <ToggleButton key={l} value={l} sx={{ px: 1.5, fontWeight: 700 }}>
                  {l.toUpperCase()}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Tooltip>

          {showPreview && (
            <ToggleButtonGroup size="small" exclusive value={device} onChange={(_, v) => v && setDevice(v)} sx={{ display: { xs: "none", lg: "flex" } }}>
              <ToggleButton value="desktop" aria-label={t("desktop")}>
                <Monitor size={16} />
              </ToggleButton>
              <ToggleButton value="mobile" aria-label={t("mobile")}>
                <Smartphone size={16} />
              </ToggleButton>
            </ToggleButtonGroup>
          )}

          <Tooltip title={showPreview ? t("hidePreview") : t("showPreview")}>
            <IconButton onClick={() => setShowPreview((s) => !s)} sx={{ display: { xs: "none", lg: "inline-flex" } }}>
              {showPreview ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
            </IconButton>
          </Tooltip>

          {isEditing && defaultData.isPublished && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<ExternalLink size={16} />}
              href={`/${lang}/${defaultData.slug}`}
              target="_blank"
            >
              {t("viewPage")}
            </Button>
          )}

          <Button
            variant="contained"
            onClick={save}
            disabled={mutation.isPending}
            startIcon={mutation.isPending ? <CircularProgress size={18} color="inherit" /> : null}
          >
            {t("save")}
          </Button>
        </Stack>
      </Paper>

      <Grid container spacing={2} sx={{ alignItems: "flex-start" }}>
        {/* Editor column */}
        <Grid size={{ xs: 12, lg: showPreview ? 5 : 12 }}>
          <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
            <Tabs value={panel} onChange={(_, v) => setPanel(v)} variant="fullWidth">
              <Tab value="blocks" label={`${t("blocks")} (${draft.blocks.length})`} />
              <Tab
                value="settings"
                label={t("pageSettings")}
                sx={errors.title || errors.slug ? { color: "error.main" } : undefined}
              />
              <Tab value="seo" label="SEO" />
            </Tabs>

            <Box sx={{ p: 2 }}>
              {panel === "blocks" && (
                <Stack spacing={1.25}>
                  {draft.blocks.length === 0 && (
                    <Stack alignItems="center" spacing={1} sx={{ py: 5, color: "text.secondary", textAlign: "center" }}>
                      <Typography fontWeight={700}>{t("noBlocksYet")}</Typography>
                      <Typography variant="body2">{t("noBlocksHint")}</Typography>
                    </Stack>
                  )}
                  <DndContext sensors={sensors} modifiers={[restrictToVerticalAxis]} onDragEnd={handleDragEnd}>
                    <SortableContext items={draft.blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                      {draft.blocks.map((block, index) => (
                        <BlockCard
                          key={block.id}
                          block={block}
                          lang={lang}
                          expanded={expandedId === block.id}
                          onToggle={() => setExpandedId((id) => (id === block.id ? null : block.id))}
                          onChange={(next) => setBlocks((blocks) => blocks.map((b) => (b.id === next.id ? next : b)))}
                          onDuplicate={() => duplicateBlock(index)}
                          onRemove={() => removeBlock(index)}
                          onInsertBelow={() => setPicker({ open: true, index: index + 1 })}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                  <Button
                    variant="outlined"
                    size="large"
                    startIcon={<Plus size={18} />}
                    onClick={() => setPicker({ open: true, index: draft.blocks.length })}
                    sx={{ borderStyle: "dashed", py: 1.5 }}
                  >
                    {t("addBlock")}
                  </Button>
                </Stack>
              )}

              {panel === "settings" && (
                <Stack spacing={2.5}>
                  <LText label={t("pageTitle")} value={draft.title} onChange={setTitle} lang={lang} />
                  {errors.title && (
                    <Typography variant="caption" color="error" mt={-2}>
                      {t("pageTitleRequired")}
                    </Typography>
                  )}
                  <Box>
                    <TextInput
                      label={t("slug")}
                      value={draft.slug}
                      onChange={(v) => {
                        setSlugTouched(true);
                        setErrors((e) => ({ ...e, slug: false }));
                        set({ slug: slugify(v.replace(/\s/g, "-")) + (v.endsWith("-") ? "-" : "") });
                      }}
                      placeholder="about-us"
                      helperText={draft.slug ? `${t("pageAddress")}: ${publicUrl}` : t("slugHelp")}
                    />
                    {errors.slug && (
                      <Typography variant="caption" color="error">
                        {t("slugRequired")}
                      </Typography>
                    )}
                  </Box>

                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                    <Typography variant="subtitle2" fontWeight={700} mb={1}>
                      {t("visibility")}
                    </Typography>
                    <Stack>
                      <FormControlLabel
                        control={<Switch checked={draft.isPublished} onChange={(e) => set({ isPublished: e.target.checked })} />}
                        label={t("publishPage")}
                      />
                      <FormControlLabel
                        control={<Switch checked={draft.showInHeader} onChange={(e) => set({ showInHeader: e.target.checked })} />}
                        label={t("showInHeader")}
                      />
                      <FormControlLabel
                        control={<Switch checked={draft.showInFooter} onChange={(e) => set({ showInFooter: e.target.checked })} />}
                        label={t("showInFooter")}
                      />
                    </Stack>
                    <Box mt={1.5} maxWidth={200}>
                      <TextInput
                        label={t("menuOrder")}
                        type="number"
                        value={draft.order}
                        onChange={(v) => set({ order: Number(v) || 0 })}
                      />
                    </Box>
                  </Paper>

                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                    <Typography variant="subtitle2" fontWeight={700} mb={2}>
                      {t("pageDesign")}
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <SelectInput
                          label={t("contentWidth")}
                          value={draft.settings.maxWidth}
                          onChange={(maxWidth) => set({ settings: { ...draft.settings, maxWidth } })}
                          options={[
                            { value: "sm", label: t("widthNarrow") },
                            { value: "md", label: t("sizeMedium") },
                            { value: "lg", label: t("widthWide") },
                            { value: "xl", label: t("widthExtraWide") },
                            { value: "full", label: t("widthFull") },
                          ]}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={draft.settings.showTitle}
                              onChange={(e) => set({ settings: { ...draft.settings, showTitle: e.target.checked } })}
                            />
                          }
                          label={t("showPageTitle")}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <ColorInput
                          label={t("backgroundColor")}
                          value={draft.settings.backgroundColor}
                          onChange={(backgroundColor) => set({ settings: { ...draft.settings, backgroundColor } })}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <ColorInput
                          label={t("textColor")}
                          value={draft.settings.textColor}
                          onChange={(textColor) => set({ settings: { ...draft.settings, textColor } })}
                        />
                      </Grid>
                    </Grid>
                  </Paper>
                </Stack>
              )}

              {panel === "seo" && (
                <Stack spacing={2.5}>
                  <Typography variant="body2" color="text.secondary">
                    {t("seoHint")}
                  </Typography>
                  <LText
                    label={t("metaTitle")}
                    value={draft.metaTitle}
                    onChange={(metaTitle) => set({ metaTitle })}
                    lang={lang}
                    placeholder={draft.title[lang]}
                  />
                  <LText
                    label={t("metaDescription")}
                    value={draft.metaDescription}
                    onChange={(metaDescription) => set({ metaDescription })}
                    lang={lang}
                    multiline
                  />
                  <Typography variant="caption" color={(draft.metaDescription?.[lang]?.length ?? 0) > 160 ? "warning.main" : "text.secondary"} mt={-2}>
                    {draft.metaDescription?.[lang]?.length ?? 0} / 160
                  </Typography>
                  <ImageField
                    label={t("shareImage")}
                    value={draft.ogImage}
                    onChange={(ogImage) => set({ ogImage })}
                    height={180}
                  />

                  {/* Search result preview */}
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }} dir={lang === "ar" ? "rtl" : "ltr"}>
                    <Typography variant="caption" color="success.main">
                      {typeof window !== "undefined" ? window.location.host : ""}
                      {publicUrl}
                    </Typography>
                    <Typography color="#1a0dab" fontSize={18} noWrap>
                      {draft.metaTitle?.[lang] || draft.title[lang] || t("untitledPage")}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {draft.metaDescription?.[lang] || t("noDescription")}
                    </Typography>
                  </Paper>
                </Stack>
              )}
            </Box>
          </Paper>
        </Grid>

        {/* Live preview */}
        {showPreview && (
          <Grid size={{ lg: 7 }} sx={{ display: { xs: "none", lg: "block" }, position: "sticky", top: 88 }}>
            <Paper
              variant="outlined"
              sx={{ borderRadius: 2, overflow: "hidden", bgcolor: "action.hover" }}
            >
              <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2, py: 1, borderBottom: 1, borderColor: "divider", bgcolor: "background.paper" }}>
                <Stack direction="row" spacing={0.6}>
                  {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
                    <Box key={c} sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: c }} />
                  ))}
                </Stack>
                <Typography variant="caption" color="text.secondary" noWrap sx={{ flex: 1, textAlign: "center" }} dir="ltr">
                  {publicUrl}
                </Typography>
                <Typography variant="caption" fontWeight={700} color="primary.main">
                  {t("livePreview")}
                </Typography>
              </Stack>
              <Box sx={{ height: "calc(100dvh - 260px)", minHeight: 420, overflow: "auto", display: "flex", justifyContent: "center" }}>
                <Box
                  sx={{
                    width: device === "mobile" ? 390 : "100%",
                    bgcolor: "#fff",
                    boxShadow: device === "mobile" ? 3 : 0,
                    my: device === "mobile" ? 2 : 0,
                    borderRadius: device === "mobile" ? 3 : 0,
                    overflow: "hidden",
                    alignSelf: "flex-start",
                  }}
                >
                  {draft.blocks.length === 0 && !draft.title[lang] ? (
                    <Stack alignItems="center" justifyContent="center" sx={{ py: 12, color: "text.disabled" }}>
                      <Typography>{t("previewEmpty")}</Typography>
                    </Stack>
                  ) : (
                    <PageRenderer
                      title={draft.title}
                      settings={draft.settings}
                      blocks={draft.blocks}
                      lang={lang}
                      activeBlockId={expandedId}
                      onSelectBlock={selectFromPreview}
                    />
                  )}
                </Box>
              </Box>
            </Paper>
          </Grid>
        )}
      </Grid>

      <BlockPicker
        open={picker.open}
        onClose={() => setPicker((p) => ({ ...p, open: false }))}
        onPick={insertBlock}
      />
    </Stack>
  );
}
