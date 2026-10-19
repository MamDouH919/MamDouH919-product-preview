"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import CustomLink from "@/components/CustomLink";
import DangerouslySetInnerHTML from "@/components/MUI/DangerouslySetInnerHTML";
import ProductCard, { ProductCardSkeleton } from "@/components/ProductCard";
import { iconsMap } from "@/components/IconPicker";
import { searchProducts } from "@/backend-api/products/queries";
import { PRODUCTS_QUERY_KEY } from "@/backend-api/products/hooks";
import { ProductSort } from "@/backend-api/products/types";
import { PageBlock } from "@/backend-api/pages/types";
import { getBackendUri } from "@/utils/helperFunctions";
import { ButtonItem, loc, safeHref } from "./registry";

export type BlockProps = { block: PageBlock; lang: string };

const COLS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 @2xl:grid-cols-2",
  3: "grid-cols-1 @2xl:grid-cols-2 @5xl:grid-cols-3",
  4: "grid-cols-2 @5xl:grid-cols-4",
};

// Tailwind's reset strips heading/link styling, so editor HTML gets it back here.
const RICH_TEXT =
  "[&_h1]:text-3xl [&_h1]:font-extrabold [&_h2]:text-2xl [&_h2]:font-bold [&_h3]:text-xl [&_h3]:font-bold [&_h4]:text-lg [&_h4]:font-semibold [&_h1:first-child]:mt-0 [&_h2:first-child]:mt-0 [&_h3:first-child]:mt-0 [&_a]:text-(--primary) [&_a]:underline [&_blockquote]:border-s-4 [&_blockquote]:border-(--primary) [&_blockquote]:ps-4 [&_blockquote]:italic [&_table]:w-full [&_td]:border [&_td]:border-black/10 [&_td]:p-2 [&_th]:border [&_th]:border-black/10 [&_th]:p-2 [&_hr]:my-6 [&_hr]:opacity-20";

function RichHtml({ html }: { html: string }) {
  return (
    <div className={RICH_TEXT}>
      <DangerouslySetInnerHTML data={html} />
    </div>
  );
}

const imgSrc = (path?: string) => (path ? getBackendUri(path) : "");

const JUSTIFY = { start: "justify-start", center: "justify-center", end: "justify-end" };
const ITEMS = { start: "items-start", center: "items-center", end: "items-end" };
const justify = (block: PageBlock) => JUSTIFY[block.style?.align ?? "start"] ?? JUSTIFY.start;
const items = (block: PageBlock) => ITEMS[block.style?.align ?? "start"] ?? ITEMS.start;

// ── Shared pieces ────────────────────────────────────────────────────────────

/** Renders an internal path through the locale-aware link, anything else as <a>. */
function SmartLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  if (href.startsWith("/")) {
    return (
      <CustomLink href={href} className={className}>
        {children}
      </CustomLink>
    );
  }
  const external = /^https?:/i.test(href);
  return (
    <a
      href={href}
      className={className}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
    >
      {children}
    </a>
  );
}

const BUTTON_CLASS: Record<ButtonItem["variant"], string> = {
  primary:
    "bg-(--primary) text-white shadow-md hover:shadow-lg hover:brightness-110",
  outline:
    "border-2 border-(--primary) text-(--primary) hover:bg-(--primary) hover:text-white",
  light: "bg-white text-gray-900 shadow-md hover:bg-gray-100",
};

// Outline buttons switch to white over images and colored backgrounds.
const OUTLINE_ON_DARK = "border-2 border-white text-white hover:bg-white hover:text-gray-900";

export function Buttons({
  buttons,
  lang,
  className = "",
  onDark = false,
}: {
  buttons?: ButtonItem[];
  lang: string;
  className?: string;
  onDark?: boolean;
}) {
  const items = (buttons ?? []).filter((b) => loc(b.label, lang) && safeHref(b.url));
  if (!items.length) return null;
  return (
    <div className={`flex flex-wrap gap-3 ${className}`}>
      {items.map((b, i) => (
        <SmartLink
          key={i}
          href={safeHref(b.url)!}
          className={`inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold transition-all duration-200 ${onDark && b.variant === "outline" ? OUTLINE_ON_DARK : BUTTON_CLASS[b.variant] ?? BUTTON_CLASS.primary}`}
        >
          {loc(b.label, lang)}
        </SmartLink>
      ))}
    </div>
  );
}

function Heading({ title, subtitle }: { title?: string; subtitle?: string }) {
  if (!title && !subtitle) return null;
  return (
    <div className="mb-8 flex flex-col gap-2">
      {title && <h2 className="text-2xl font-bold @3xl:text-3xl">{title}</h2>}
      {subtitle && <p className="text-base opacity-75 @3xl:text-lg">{subtitle}</p>}
    </div>
  );
}

// ── Blocks ───────────────────────────────────────────────────────────────────

const HERO_HEIGHT: Record<string, string> = {
  sm: "min-h-[280px]",
  md: "min-h-[420px]",
  lg: "min-h-[560px]",
  screen: "min-h-[calc(100dvh-96px)]",
};

export function HeroBlock({ block, lang }: BlockProps) {
  const d = block.data;
  const image = imgSrc(d.image);
  const overlay = Math.min(Math.max(Number(d.overlay ?? 45), 0), 90) / 100;
  const title = loc(d.title, lang);
  const subtitle = loc(d.subtitle, lang);

  return (
    <div
      className={`relative flex items-center overflow-hidden ${HERO_HEIGHT[d.height] ?? HERO_HEIGHT.md} ${image ? "text-white" : ""}`}
      style={!image ? { background: "linear-gradient(135deg, var(--primary-10), transparent)" } : undefined}
    >
      {image && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt={title} className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-black" style={{ opacity: overlay }} />
        </>
      )}
      <div className={`relative mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-16 ${items(block)}`}>
        {title && <h1 className="text-3xl font-extrabold leading-tight @3xl:text-5xl">{title}</h1>}
        {subtitle && <p className="text-base opacity-90 @3xl:text-xl">{subtitle}</p>}
        <Buttons buttons={d.buttons} lang={lang} onDark={!!image} className={`pt-2 ${justify(block)}`} />
      </div>
    </div>
  );
}

export function RichTextBlock({ block, lang }: BlockProps) {
  const html = loc(block.data.content, lang);
  if (!html) return null;
  return <RichHtml html={html} />;
}

export function ImageBlock({ block, lang }: BlockProps) {
  const d = block.data;
  if (!d.image) return null;
  const caption = loc(d.caption, lang);
  const href = safeHref(d.link);
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imgSrc(d.image)}
      alt={loc(d.alt, lang) || caption}
      loading="lazy"
      className={`h-auto w-full ${d.rounded ? "rounded-2xl" : ""}`}
    />
  );
  return (
    <figure className="flex flex-col gap-3">
      {href ? <SmartLink href={href}>{img}</SmartLink> : img}
      {caption && <figcaption className="text-center text-sm opacity-70">{caption}</figcaption>}
    </figure>
  );
}

export function ImageTextBlock({ block, lang }: BlockProps) {
  const d = block.data;
  const title = loc(d.title, lang);
  const html = loc(d.content, lang);
  return (
    <div className="grid grid-cols-1 items-center gap-8 @3xl:grid-cols-2 @3xl:gap-12">
      <div className={d.imagePosition === "end" ? "@3xl:order-2" : ""}>
        {d.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imgSrc(d.image)} alt={title} loading="lazy" className="h-auto w-full rounded-2xl object-cover" />
        ) : (
          <div className="aspect-[4/3] w-full rounded-2xl bg-gray-100" />
        )}
      </div>
      <div className="flex flex-col gap-4">
        {title && <h2 className="text-2xl font-bold @3xl:text-3xl">{title}</h2>}
        {html && <RichHtml html={html} />}
        <Buttons buttons={d.buttons} lang={lang} className="pt-2" />
      </div>
    </div>
  );
}

export function GalleryBlock({ block, lang }: BlockProps) {
  const d = block.data;
  const images: { image: string; caption?: Record<string, string> }[] = (d.images ?? []).filter(
    (i: any) => i.image,
  );
  if (!images.length) return null;
  return (
    <div>
      <Heading title={loc(d.title, lang)} />
      <div className={`grid gap-4 ${COLS[d.columns] ?? COLS[3]}`}>
        {images.map((item, i) => {
          const caption = loc(item.caption, lang);
          return (
            <figure key={i} className="group overflow-hidden rounded-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imgSrc(item.image)}
                alt={caption}
                loading="lazy"
                className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              {caption && <figcaption className="pt-2 text-center text-sm opacity-70">{caption}</figcaption>}
            </figure>
          );
        })}
      </div>
    </div>
  );
}

export function FeaturesBlock({ block, lang }: BlockProps) {
  const d = block.data;
  const items: any[] = d.items ?? [];
  return (
    <div>
      <Heading title={loc(d.title, lang)} subtitle={loc(d.subtitle, lang)} />
      <div className={`grid gap-5 ${COLS[d.columns] ?? COLS[3]}`}>
        {items.map((item, i) => {
          const Icon = item.icon ? iconsMap[item.icon] : undefined;
          return (
            <div
              key={i}
              className="flex flex-col gap-3 rounded-2xl border border-black/5 bg-white/70 p-6 text-start shadow-sm transition-shadow hover:shadow-md"
            >
              {Icon && (
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-(--primary-10) text-(--primary)">
                  <Icon className="h-6 w-6" />
                </span>
              )}
              {loc(item.title, lang) && (
                <h3 className="text-lg font-bold text-gray-900">{loc(item.title, lang)}</h3>
              )}
              {loc(item.description, lang) && (
                <p className="text-sm leading-relaxed text-gray-600">{loc(item.description, lang)}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function StatsBlock({ block, lang }: BlockProps) {
  const d = block.data;
  const items: any[] = d.items ?? [];
  return (
    <div>
      <Heading title={loc(d.title, lang)} />
      <div className={`grid gap-6 ${COLS[Math.min(Math.max(items.length, 1), 4)]}`}>
        {items.map((item, i) => (
          <div key={i} className="flex flex-col items-center gap-1 text-center">
            <span className="text-4xl font-extrabold text-(--primary) @3xl:text-5xl">{item.value}</span>
            <span className="text-sm font-medium opacity-75">{loc(item.label, lang)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CtaBlock({ block, lang }: BlockProps) {
  const d = block.data;
  const hasOwnBg = !!block.style?.backgroundColor;
  return (
    <div
      className={`flex flex-col gap-4 rounded-3xl px-6 py-12 @3xl:px-12 ${items(block)} ${hasOwnBg ? "" : "bg-(--primary) text-white"}`}
    >
      {loc(d.title, lang) && <h2 className="text-2xl font-bold @3xl:text-4xl">{loc(d.title, lang)}</h2>}
      {loc(d.text, lang) && <p className="max-w-2xl text-base opacity-90 @3xl:text-lg">{loc(d.text, lang)}</p>}
      <Buttons
        buttons={(d.buttons ?? []).map((b: ButtonItem) =>
          hasOwnBg || b.variant !== "primary" ? b : { ...b, variant: "light" },
        )}
        lang={lang}
        onDark={!hasOwnBg}
        className={`pt-2 ${justify(block)}`}
      />
    </div>
  );
}

export function FaqBlock({ block, lang }: BlockProps) {
  const d = block.data;
  const items: any[] = (d.items ?? []).filter((i: any) => loc(i.question, lang));
  return (
    <div>
      <Heading title={loc(d.title, lang)} />
      <div className="flex flex-col gap-3 text-start">
        {items.map((item, i) => (
          <details
            key={i}
            className="group rounded-2xl border border-black/10 bg-white/70 px-5 py-4 open:shadow-sm"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-gray-900 [&::-webkit-details-marker]:hidden">
              {loc(item.question, lang)}
              <ChevronDown className="h-5 w-5 shrink-0 text-(--primary) transition-transform duration-200 group-open:rotate-180" />
            </summary>
            <div className="pt-3 text-sm leading-relaxed text-gray-600">
              <DangerouslySetInnerHTML data={loc(item.answer, lang)} />
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

/** Turns a YouTube/Vimeo page URL into its embeddable player URL. */
export function toEmbedUrl(url: string): { kind: "iframe" | "video"; src: string } | null {
  const value = (url ?? "").trim();
  const yt = value.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/,
  );
  if (yt) return { kind: "iframe", src: `https://www.youtube-nocookie.com/embed/${yt[1]}` };
  const vimeo = value.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return { kind: "iframe", src: `https://player.vimeo.com/video/${vimeo[1]}` };
  if (/^https:\/\/.+\.(mp4|webm)(\?.*)?$/i.test(value)) return { kind: "video", src: value };
  return null;
}

export function VideoBlock({ block, lang }: BlockProps) {
  const d = block.data;
  const embed = toEmbedUrl(d.url);
  if (!embed) return null;
  const title = loc(d.title, lang);
  return (
    <div>
      <Heading title={title} />
      <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-lg">
        {embed.kind === "iframe" ? (
          <iframe
            src={embed.src}
            title={title || "video"}
            className="h-full w-full"
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <video src={embed.src} controls className="h-full w-full" />
        )}
      </div>
    </div>
  );
}

export function ButtonsBlock({ block, lang }: BlockProps) {
  return <Buttons buttons={block.data.buttons} lang={lang} className={justify(block)} />;
}

export function ProductsBlock({ block, lang }: BlockProps) {
  const d = block.data;
  const limit = Math.min(Math.max(Number(d.limit) || 8, 1), 24);
  const params = {
    categoryId: d.categoryId || undefined,
    sort: (d.sort || "featured") as ProductSort,
    limit,
  };
  const { data, isLoading } = useQuery({
    queryKey: [PRODUCTS_QUERY_KEY, "search", "page-block", params],
    queryFn: () => searchProducts({ ...params, page: 1 }),
  });
  const products = data?.data ?? [];

  return (
    <div>
      <Heading title={loc(d.title, lang)} />
      <div className="grid grid-cols-2 gap-4 @3xl:grid-cols-3 @5xl:grid-cols-4">
        {isLoading
          ? Array.from({ length: Math.min(limit, 4) }).map((_, i) => <ProductCardSkeleton key={i} />)
          : products.map((p) => <ProductCard key={p._id} product={p} lang={lang} />)}
      </div>
    </div>
  );
}

export function SpacerBlock({ block }: BlockProps) {
  const h = Math.min(Math.max(Number(block.data.height) || 0, 0), 400);
  return <div aria-hidden style={{ height: h }} />;
}

export function DividerBlock({ block }: BlockProps) {
  const t = Math.min(Math.max(Number(block.data.thickness) || 1, 1), 12);
  return (
    <hr
      className="border-0"
      style={{ height: t, background: block.data.color || "currentColor", opacity: block.data.color ? 1 : 0.12 }}
    />
  );
}

export const BLOCK_RENDERERS: Record<PageBlock["type"], React.ComponentType<BlockProps>> = {
  hero: HeroBlock,
  richText: RichTextBlock,
  image: ImageBlock,
  imageText: ImageTextBlock,
  gallery: GalleryBlock,
  features: FeaturesBlock,
  stats: StatsBlock,
  cta: CtaBlock,
  faq: FaqBlock,
  video: VideoBlock,
  buttons: ButtonsBlock,
  products: ProductsBlock,
  spacer: SpacerBlock,
  divider: DividerBlock,
};
