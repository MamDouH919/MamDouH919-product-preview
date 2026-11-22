'use client';
import Link from 'next/link';
import { Fragment } from 'react';
import { Box, Button, IconButton, Stack, Tooltip, Typography, useMediaQuery } from '@mui/material';
import { alpha } from '@mui/material/styles';
import HomeRounded from '@mui/icons-material/HomeRounded';
import FileDownloadOutlined from '@mui/icons-material/FileDownloadOutlined';
import RefreshRounded from '@mui/icons-material/RefreshRounded';
import Add from '@mui/icons-material/Add';
import ChevronLeft from '@mui/icons-material/ChevronLeft';
import ChevronRight from '@mui/icons-material/ChevronRight';
import HelpOutline from '@mui/icons-material/HelpOutline';
import { usePathname, useRouter } from 'next/navigation';
import { useBreadcrumbs } from '@/Hooks/useBreadcrumbs';
import { helpTopicFor } from '@/features/Help/guide';
import { useAppSelector } from '@/Store/store';
import { useTranslation } from 'react-i18next';
import { PAGE_ACTIONS_SLOT_ID } from './PageActions';

export type ButtonItem = {
    id: string;
    label: string;
    icon: React.ReactNode;
    link?: string;
    onClick?: () => void;
    pages: string[];
};

export const Icons = {
    add: <Add />,
    export: <FileDownloadOutlined />,
    refresh: <RefreshRounded />,
}

interface Props {
    title: string;
}

export default function LongText({ title }: Props) {
    const isLong = title.length > 20;

    const text = (
        <Typography
            sx={{
                maxWidth: 150,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
            }}
        >
            {title}
        </Typography>
    );

    return isLong ? (
        <Tooltip title={title} arrow>
            {text}
        </Tooltip>
    ) : (
        text
    );
}

export const BREADCRUMB_HEIGHT = 52;

export function Breadcrumbs() {
    const items = useBreadcrumbs();
    const { breadCrumbBtns } = useAppSelector(state => state.breadCrumb);
    const { t, i18n } = useTranslation()
    const router = useRouter()
    const compact = useMediaQuery('(max-width:600px)')
    // The route without its locale, e.g. "/admin/returns/123".
    const pagePath = usePathname().replace(/^\/[^/]+/, "")
    const Separator = i18n.dir() === "rtl" ? ChevronLeft : ChevronRight

    const trail = items ?? []
    const current = trail[trail.length - 1]
    // On a phone the whole trail doesn't fit: show only the parent link and the current page.
    const visibleTrail = compact ? trail.slice(-2) : trail

    return (
        <Box sx={{
            width: '100%',
            minHeight: BREADCRUMB_HEIGHT,
            px: { xs: 1.5, sm: 2.5 },
            display: 'flex',
            alignItems: 'center',
            bgcolor: (t) => alpha(t.palette.background.paper, 0.85),
            backdropFilter: 'blur(8px)',
            borderBottom: 1,
            borderColor: 'divider',
            position: 'sticky',
            top: 0,
            zIndex: 2,
        }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" width="100%" gap={2}>
                <Stack direction="row" alignItems="center" gap={0.25} minWidth={0} component="nav" aria-label="breadcrumb">
                    <Tooltip title={t("dashboard")}>
                        <IconButton component={Link} href="/admin" size="small" aria-label={t("dashboard")} sx={{ color: 'text.secondary', borderRadius: 1.5 }}>
                            <HomeRounded fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    {visibleTrail.map((item: any) => {
                        const isCurrent = item === current
                        return (
                            <Fragment key={item.title}>
                                <Separator fontSize="small" sx={{ color: 'text.disabled', flexShrink: 0 }} />
                                {isCurrent ? (
                                    <Typography variant="subtitle2" fontWeight={700} noWrap aria-current="page" sx={{ px: 0.75, maxWidth: { xs: 180, sm: 360 } }}>
                                        {item.title}
                                    </Typography>
                                ) : (
                                    <Box
                                        component={Link}
                                        href={item.link ?? '#'}
                                        sx={{
                                            px: 0.75, py: 0.25, borderRadius: 1.5, textDecoration: 'none',
                                            color: 'text.secondary', fontSize: 14, whiteSpace: 'nowrap',
                                            maxWidth: { xs: 120, sm: 200 }, overflow: 'hidden', textOverflow: 'ellipsis',
                                            '&:hover': { color: 'primary.main', bgcolor: (t) => alpha(t.palette.primary.main, 0.08) },
                                        }}
                                    >
                                        {item.title}
                                    </Box>
                                )}
                            </Fragment>
                        )
                    })}
                </Stack>

                <Stack direction="row" alignItems="center" gap={0.75} flexShrink={0}>
                    {pagePath !== "/admin/help" && (
                        <Tooltip title={t("helpForThisPage")}>
                            <IconButton
                                component={Link}
                                href={`/${i18n.language}/admin/help?tab=${helpTopicFor(pagePath)}`}
                                size="small"
                                aria-label={t("helpForThisPage")}
                                sx={{ color: 'text.secondary' }}
                            >
                                <HelpOutline fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    )}
                    <Stack id={PAGE_ACTIONS_SLOT_ID} direction="row" alignItems="center" gap={0.75} />
                    {breadCrumbBtns && breadCrumbBtns.map((btn: any, index: number) => (
                        <BreadCrumbBtn
                            key={btn.id ?? index}
                            primary={btn.icon === "add"}
                            compact={compact}
                            onClick={btn.onClick}
                            link={btn.link}
                            title={btn.title}
                            onNavigate={(href: string) => router.push(href)}
                        >
                            {Icons[btn.icon as keyof typeof Icons]}
                        </BreadCrumbBtn>
                    ))}
                </Stack>
            </Stack>
        </Box>
    );
}

interface BreadCrumbBtnProps {
    onClick?: () => void;
    link?: string;
    children: React.ReactNode;
    title: string;
    /** "Add" style actions are the page's main call to action: a filled button with a label. */
    primary?: boolean;
    compact?: boolean;
    onNavigate: (href: string) => void;
}

function BreadCrumbBtn({ onClick, link, title, children, primary, compact, onNavigate }: BreadCrumbBtnProps) {
    const handle = () => {
        onClick?.()
        if (link) onNavigate(link)
    }

    if (primary && !compact) {
        return (
            <Button
                variant="contained"
                size="small"
                disableElevation
                startIcon={children}
                onClick={handle}
                sx={{ borderRadius: 2.5, height: 34, px: 1.75, fontWeight: 600, whiteSpace: 'nowrap' }}
            >
                {title}
            </Button>
        )
    }

    return (
        <Tooltip title={title}>
            <IconButton
                onClick={handle}
                size="small"
                aria-label={title}
                sx={primary
                    ? { bgcolor: 'primary.main', color: 'primary.contrastText', '&:hover': { bgcolor: 'primary.dark' } }
                    : { color: 'text.secondary', border: 1, borderColor: 'divider' }}
            >
                {children}
            </IconButton>
        </Tooltip>
    )
}
