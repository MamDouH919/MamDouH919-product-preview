"use client";

import { Fragment, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Alert, Box, Button, Chip, Paper, Stack, Tab, Tabs, Typography } from "@mui/material";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  ExternalLink,
  FileUp,
  Lightbulb,
  Package,
  Rocket,
  ShoppingCart,
  Truck,
  Undo2,
  Wallet,
} from "lucide-react";
import { useAppDispatch } from "@/Store/store";
import { changeBreadCrumbActions, resetBreadCrumbActions } from "@/Store/slices/bread-crumb";
import CustomLink from "@/components/CustomLink";
import { HELP_TOPICS, HelpBlock, HelpSection, HelpTopicId, helpGuide } from "@/features/Help/guide";

const TOPIC_ICONS: Record<HelpTopicId, React.ElementType> = {
  start: Rocket,
  orders: ShoppingCart,
  returns: Undo2,
  accounts: Wallet,
  purchases: Truck,
  inventory: Package,
  import: FileUp,
  reports: BarChart3,
};

/**
 * How to use the dashboard, one tab per area. The tab lives in `?tab=` so the
 * help button on every page can open the part that explains it.
 */
const HelpPage = () => {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const guide = helpGuide(i18n.language);
  const requested = params.get("tab") as HelpTopicId | null;
  const tab: HelpTopicId = requested && HELP_TOPICS.includes(requested) ? requested : "start";
  const topic = guide[tab];

  useEffect(() => {
    dispatch(changeBreadCrumbActions({ breadCrumb: [{ title: t("helpGuide") }], breadCrumbBtns: [] }));
    return () => {
      dispatch(resetBreadCrumbActions());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeTab = (next: HelpTopicId) => {
    router.replace(`${pathname}?tab=${next}`, { scroll: false });
    document.getElementById("help-top")?.scrollIntoView();
  };

  return (
    <Stack id="help-top" spacing={2} pb={4}>
      <Paper variant="outlined" sx={{ borderRadius: 2, position: "sticky", top: 0, zIndex: 2 }}>
        <Tabs value={tab} onChange={(_, v) => changeTab(v)} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile>
          {HELP_TOPICS.map((id) => {
            const Icon = TOPIC_ICONS[id];
            return <Tab key={id} value={id} label={guide[id].label} icon={<Icon size={18} />} iconPosition="start" sx={{ minHeight: 52 }} />;
          })}
        </Tabs>
      </Paper>

      <Stack spacing={1}>
        <Typography variant="h5" fontWeight={700}>{topic.label}</Typography>
        <Typography color="text.secondary">{topic.summary}</Typography>
        {topic.sections.length > 1 && (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap pt={1}>
            {topic.sections.map((section, i) => (
              <Chip
                key={section.title}
                variant="outlined"
                size="small"
                clickable
                label={`${i + 1}. ${section.title}`}
                onClick={() => document.getElementById(`${tab}-${i}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
              />
            ))}
          </Stack>
        )}
      </Stack>

      {topic.sections.map((section, i) => (
        <SectionCard key={`${tab}-${i}`} id={`${tab}-${i}`} number={i + 1} section={section} />
      ))}

      <NextTopic current={tab} onGo={changeTab} />
    </Stack>
  );
};

const SectionCard = ({ id, number, section }: { id: string; number: number; section: HelpSection }) => {
  const { t } = useTranslation();
  return (
    <Paper id={id} variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2, scrollMarginTop: 72 }}>
      <Stack direction="row" spacing={1.5} alignItems="center" mb={2} flexWrap="wrap" useFlexGap>
        <Box
          sx={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            bgcolor: "primary.main",
            color: "primary.contrastText",
            display: "grid",
            placeItems: "center",
            fontWeight: 700,
            fontSize: 14,
            flexShrink: 0,
          }}
        >
          {number}
        </Box>
        <Typography variant="h6" fontWeight={700} flex={1} minWidth={0}>{section.title}</Typography>
        {section.path && (
          <CustomLink href={section.path}>
            <Button size="small" variant="outlined" endIcon={<ExternalLink size={14} />}>{t("openPage")}</Button>
          </CustomLink>
        )}
      </Stack>
      <Stack spacing={2}>
        {section.blocks.map((block, i) => <Block key={i} block={block} />)}
      </Stack>
    </Paper>
  );
};

const Block = ({ block }: { block: HelpBlock }) => {
  const { t, i18n } = useTranslation();
  switch (block.type) {
    case "p":
      return <Typography variant="body2" lineHeight={1.9}><Rich text={block.text} /></Typography>;
    case "steps":
    case "list": {
      const ordered = block.type === "steps";
      return (
        <Box>
          {block.title && <Typography variant="subtitle2" fontWeight={700} mb={1}>{block.title}</Typography>}
          <Stack spacing={1.25} component={ordered ? "ol" : "ul"} sx={{ m: 0, p: 0, listStyle: "none" }}>
            {block.items.map((item, i) => (
              <Stack key={i} component="li" direction="row" spacing={1.5} alignItems="flex-start">
                {ordered ? (
                  <Box
                    sx={{
                      minWidth: 24,
                      height: 24,
                      borderRadius: 1,
                      bgcolor: "action.selected",
                      display: "grid",
                      placeItems: "center",
                      fontSize: 12,
                      fontWeight: 700,
                      mt: 0.25,
                    }}
                  >
                    {i + 1}
                  </Box>
                ) : (
                  <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "primary.main", mt: 1.1, flexShrink: 0 }} />
                )}
                <Typography variant="body2" lineHeight={1.9}><Rich text={item} /></Typography>
              </Stack>
            ))}
          </Stack>
        </Box>
      );
    }
    case "flow": {
      const Arrow = i18n.dir() === "rtl" ? ArrowLeft : ArrowRight;
      return (
        <Box>
          {block.title && <Typography variant="subtitle2" fontWeight={700} mb={1}>{block.title}</Typography>}
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            {block.items.map((item, i) => (
              <Fragment key={item}>
                {i > 0 && <Arrow size={16} style={{ opacity: 0.5 }} />}
                <Chip size="small" color={i === block.items.length - 1 ? "success" : "default"} label={item} />
              </Fragment>
            ))}
          </Stack>
        </Box>
      );
    }
    case "tip":
      return (
        <Alert severity="info" icon={<Lightbulb size={20} />}>
          <Rich text={block.text} />
        </Alert>
      );
    case "warning":
      return (
        <Alert severity="warning">
          <Rich text={block.text} />
        </Alert>
      );
    case "example":
      return (
        <Box sx={{ borderInlineStart: 3, borderColor: "primary.main", bgcolor: "action.hover", borderRadius: 1, p: 2 }}>
          <Typography variant="subtitle2" fontWeight={700} mb={1}>{block.title}</Typography>
          <Stack spacing={0.5}>
            {block.lines.map((line, i) => (
              <Typography key={i} variant="body2" lineHeight={1.8}><Rich text={line} /></Typography>
            ))}
          </Stack>
        </Box>
      );
    case "faq":
      return (
        <Stack spacing={1.5}>
          {block.items.map((item) => (
            <Box key={item.q}>
              <Typography variant="body2" fontWeight={700}>{t("helpQuestion")}: {item.q}</Typography>
              <Typography variant="body2" color="text.secondary" lineHeight={1.9}><Rich text={item.a} /></Typography>
            </Box>
          ))}
        </Stack>
      );
  }
};

/** Renders **bold** spans; the guide uses them for the names of buttons and fields. */
const Rich = ({ text }: { text: string }) => (
  <>
    {text.split("**").map((part, i) => (i % 2 ? <Box key={i} component="strong" fontWeight={700}>{part}</Box> : part))}
  </>
);

const NextTopic = ({ current, onGo }: { current: HelpTopicId; onGo: (id: HelpTopicId) => void }) => {
  const { t, i18n } = useTranslation();
  const index = HELP_TOPICS.indexOf(current);
  const next = HELP_TOPICS[index + 1];
  if (!next) return null;
  const Arrow = i18n.dir() === "rtl" ? ArrowLeft : ArrowRight;
  return (
    <Stack direction="row" justifyContent="flex-end">
      <Button endIcon={<Arrow size={16} />} onClick={() => onGo(next)}>
        {t("helpNextTopic")}: {helpGuide(i18n.language)[next].label}
      </Button>
    </Stack>
  );
};

export default HelpPage;
