
import { useMemo } from "react";
import {
    Inventory2Outlined,
    MiscellaneousServices,
    Settings,
    ViewCarousel,
    ContactMail,
    Handshake,
    Gavel,
    StorageOutlined,
    WarehouseOutlined,
    PeopleAltOutlined,
    ReceiptLongOutlined,
    LocalOfferOutlined,
    MarkEmailReadOutlined,
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
            primary: t("orders"),
            pathname: "/admin/orders",
            icon: ReceiptLongOutlined,
        },
        {
            primary: t("coupons"),
            pathname: "/admin/coupons",
            icon: LocalOfferOutlined,
        },
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
            primary: t("inventory"),
            pathname: "/admin/inventory",
            icon: WarehouseOutlined,
        },
        {
            primary: t("customers"),
            pathname: "/admin/customers",
            icon: PeopleAltOutlined,
        },
        {
            primary: t("contactMessages"),
            pathname: "/admin/contact",
            icon: ContactMail,
        },
        {
            primary: t("subscribers"),
            pathname: "/admin/subscribers",
            icon: MarkEmailReadOutlined,
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
