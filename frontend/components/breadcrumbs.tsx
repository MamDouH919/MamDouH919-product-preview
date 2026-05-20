'use client';
import Link from 'next/link';
import { Fragment } from 'react';
import { Box, IconButton, Stack, Tooltip, Typography, useTheme } from '@mui/material';
import Add from '@mui/icons-material/Add';
import ChevronLeft from '@mui/icons-material/ChevronLeft';
import ChevronRight from '@mui/icons-material/ChevronRight';
import { useBreadcrumbs } from '@/Hooks/useBreadcrumbs';
import { useAppSelector } from '@/Store/store';
import CustomLink from './CustomLink';
import { useTranslation } from 'react-i18next';

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

export function Breadcrumbs() {
    const items = useBreadcrumbs();
    const { breadCrumbBtns } = useAppSelector(state => state.breadCrumb);
    const theme = useTheme()
    const { t, i18n } = useTranslation()

    return (
        <Box sx={{
            width: '100%',
            height: 40,
            px: 2,
            display: 'flex',
            alignItems: 'center',
            bgcolor: 'background.paper',
            borderBottom: 1,
            borderColor: 'divider',
        }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" width="100%">
                <Stack direction="row" alignItems="center" gap={0.5} flexWrap="wrap">
                    <Box>
                        <CustomLink href={"/admin"} color={theme.palette.primary.main}>
                            <LongText title={t("dashboard")} />
                        </CustomLink>
                    </Box>
                    <Box sx={{ alignItems: 'center' }}>
                        {i18n.dir() === "rtl" ?
                            <ChevronLeft fontSize="small" sx={{ color: 'text.secondary' }} />
                            : <ChevronRight fontSize="small" sx={{ color: 'text.secondary' }} />}
                    </Box>
                    {items?.map((item: any, index: number) => (
                        <Fragment key={item.title}>
                            {index !== items.length - 1 && (
                                <Box>
                                    <CustomLink href={item.link} color={theme.palette.primary.main}>
                                        <LongText title={item.title} />
                                    </CustomLink>
                                </Box>
                            )}
                            {index < items.length - 1 && (
                                <Box sx={{ alignItems: 'center' }}>
                                    {i18n.dir() === "rtl" ?
                                        <ChevronLeft fontSize="small" sx={{ color: 'text.secondary' }} />
                                        : <ChevronRight fontSize="small" sx={{ color: 'text.secondary' }} />}
                                </Box>
                            )}
                            {index === items.length - 1 && (
                                <LongText title={item.title} />
                            )}
                        </Fragment>
                    ))}
                </Stack>
                <Stack spacing={0.5} direction="row">
                    {breadCrumbBtns && breadCrumbBtns.map((btn: any, index: number) => (
                        <BreadCrumbBtn
                            key={index}
                            onClick={btn.onClick}
                            link={btn.link}
                            title={btn.title}
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
}

function BreadCrumbBtn({ onClick, link, title, children }: BreadCrumbBtnProps) {
    if (link) {
        return (
            <Link href={link}>
                <Tooltip title={title}>
                    <IconButton onClick={onClick} size='small'>
                        {children}
                    </IconButton>
                </Tooltip>
            </Link>
        )
    }

    return (
        <Tooltip title={title}>
            <IconButton onClick={onClick} size='small'>
                {children}
            </IconButton>
        </Tooltip>
    )
}
