
import { useMemo } from "react";
import {
    Inventory2Outlined,
    MiscellaneousServices,
    Settings,
    ViewCarousel,
    FormatQuote,
    ContactMail,
    Newspaper,
    MarkEmailRead,
    Handshake,
    Gavel,
    StorageOutlined,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { useAppSelector } from "@/Store/store";

interface LinkItem {
    pathname?: string;
    primary: string;
    icon?: React.ElementType;
    permission?: string;
    action?: () => void;
    children?: LinkItem[];
    sectionName?: string;
    id?: string;
    regex?: RegExp;
    collapse?: string;
    show?: boolean;
}

export const useLinksList = () => {
    const { t } = useTranslation()
    const isSuper = useAppSelector((state) => state.auth.isSuper)

    const linksList: LinkItem[] = useMemo(() => [
        {
            primary: t("banners"),
            pathname: "/admin/banners",
            icon: ViewCarousel,
        },
        {
            primary: t("sections"),
            pathname: "/admin/sections",
            icon: Inventory2Outlined,
        },
        {
            primary: t("categories"),
            pathname: "/admin/categories",
            icon: MiscellaneousServices,
        },
        {
            primary: t("subCategories"),
            pathname: "/admin/sub-categories",
            icon: Gavel,
        },
        {
            primary: t("products"),
            pathname: "/admin/products",
            icon: Handshake,
        },
        {
            primary: t("settings"),
            pathname: "/admin/settings",
            icon: Settings,
        },

        ...(isSuper ? [{
            primary: t("database"),
            pathname: "/admin/database",
            icon: StorageOutlined,
        }] : []),
    ], [t, isSuper]);

    return linksList
}
