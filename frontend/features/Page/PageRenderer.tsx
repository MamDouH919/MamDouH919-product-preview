"use client";

import { alpha, useTheme } from "@mui/material/styles";
import { BlockSpacing, PageBlock, PageSettings, PageWidth } from "@/backend-api/pages/types";
import { LocalizedField } from "@/backend-api/globalTypes";
import { BLOCK_RENDERERS } from "./blocks/renderers";
import { loc } from "./blocks/registry";

export const WIDTH_CLASS: Record<PageWidth, string> = {
  sm: "max-w-3xl",
  md: "max-w-5xl",
  lg: "max-w-6xl",
  xl: "max-w-7xl",
  full: "max-w-none",
};

const PADDING_CLASS: Record<BlockSpacing, string> = {
  none: "py-0",
  sm: "py-6",
  md: "py-12",
  lg: "py-20",
  xl: "py-28",
};

const ALIGN_CLASS = { start: "text-start", center: "text-center", end: "text-end" };

// Anchors become element ids; keep them to characters that are safe in a URL hash.
const safeAnchor = (value?: string) =>
  value ? value.trim().replace(/[^\w-]/g, "-").slice(0, 60) || undefined : undefined;

function BlockFrame({
  block,
  pageWidth,
  lang,
  active,
  onSelect,
}: {
  block: PageBlock;
  pageWidth: PageWidth;
  lang: string;
  active?: boolean;
  onSelect?: (id: string) => void;
}) {
  const Renderer = BLOCK_RENDERERS[block.type];
  if (!Renderer) return null;

  const style = block.style ?? {};
  const width = !style.width || style.width === "inherit" ? pageWidth : style.width;
  // Full-width blocks touch the screen edges; everything else gets a gutter.
  const gutter = width === "full" ? "" : "px-4";

  // In the builder preview a click selects the block, and links must not
  // navigate away from unsaved work.
  const selectable = onSelect
    ? {
        onClickCapture: (e: React.MouseEvent) => {
          if ((e.target as HTMLElement).closest("a")) e.preventDefault();
          onSelect(block.id);
        },
        className: `cursor-pointer outline-offset-[-2px] hover:outline-2 hover:outline-dashed hover:outline-(--primary) ${active ? "outline-2 outline-solid outline-(--primary)" : ""}`,
      }
    : { className: "" };

  return (
    <section
      id={safeAnchor(style.anchor)}
      onClickCapture={selectable.onClickCapture}
      className={`${PADDING_CLASS[style.paddingY ?? "md"] ?? PADDING_CLASS.md} ${ALIGN_CLASS[style.align ?? "start"] ?? ""} ${selectable.className}`}
      style={{
        backgroundColor: style.backgroundColor || undefined,
        color: style.textColor || undefined,
      }}
    >
      <div className={`mx-auto w-full ${WIDTH_CLASS[width]} ${gutter}`}>
        <Renderer block={block} lang={lang} />
      </div>
    </section>
  );
}

interface PageRendererProps {
  title?: LocalizedField;
  settings?: Partial<PageSettings>;
  blocks: PageBlock[];
  lang: string;
  /** Builder preview only: highlights this block. */
  activeBlockId?: string | null;
  /** Builder preview only: called when a block is clicked. */
  onSelectBlock?: (id: string) => void;
}

export default function PageRenderer({
  title,
  settings,
  blocks,
  lang,
  activeBlockId,
  onSelectBlock,
}: PageRendererProps) {
  const theme = useTheme();
  const pageWidth = settings?.maxWidth ?? "lg";
  const heading = loc(title, lang);
  const visible = blocks.filter((b) => b.visible !== false);
  // A page that opens with a hero already has its own headline.
  const showTitle = (settings?.showTitle ?? true) && !!heading && visible[0]?.type !== "hero";

  const cssVars = {
    "--primary": theme.palette.primary.main,
    "--primary-10": alpha(theme.palette.primary.main, 0.1),
    backgroundColor: settings?.backgroundColor || undefined,
    color: settings?.textColor || undefined,
  } as React.CSSProperties;

  return (
    <article dir={lang === "ar" ? "rtl" : "ltr"} style={cssVars} className="@container min-h-[40vh] break-words">
      {showTitle && (
        <header className={`mx-auto w-full px-4 pt-8 ${WIDTH_CLASS[pageWidth]}`}>
          <h1 className="text-3xl font-extrabold @3xl:text-4xl">{heading}</h1>
        </header>
      )}
      {visible.map((block) => (
        <BlockFrame
          key={block.id}
          block={block}
          pageWidth={pageWidth}
          lang={lang}
          active={activeBlockId === block.id}
          onSelect={onSelectBlock}
        />
      ))}
    </article>
  );
}
