
import { useMemo } from "react";
import {
    Database,
    LayoutGrid,
    MessagesSquare,
    MonitorSmartphone,
    Package,
    Settings,
    ShoppingCart,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAppSelector } from "@/Store/store";

export interface LinkItem {
    primary: string;
    /** Route under the locale, e.g. "/admin/orders". Groups have none. */
    pathname?: string;
    icon?: React.ElementType;
    /** Sub-links; an item with children renders as a collapsible group. */
    children?: LinkItem[];
    /** Match only the exact path (for "/admin", which prefixes every route). */
    exact?: boolean;
}

export const useLinksList = () => {
    const { t } = useTranslation()
    const isSuper = useAppSelector((state) => state.auth.isSuper)

    const linksList: LinkItem[] = useMemo(() => [
        {
            primary: t("dashboard"),
            pathname: "/admin",
            icon: LayoutGrid,
            exact: true,
        },
        {
            primary: t("navSales"),
            icon: ShoppingCart,
            children: [
                { primary: t("orders"), pathname: "/admin/orders" },
                { primary: t("returns"), pathname: "/admin/returns" },
                { primary: t("coupons"), pathname: "/admin/coupons" },
                { primary: t("priceList"), pathname: "/admin/price-list" },
                { primary: t("customers"), pathname: "/admin/customers" },
            ],
        },
        {
            primary: t("navCatalog"),
            icon: Package,
            children: [
                { primary: t("products"), pathname: "/admin/products" },
                { primary: t("categories"), pathname: "/admin/categories" },
                { primary: t("subCategories"), pathname: "/admin/sub-categories" },
                { primary: t("inventory"), pathname: "/admin/inventory" },
                { primary: t("reviews"), pathname: "/admin/reviews" },
            ],
        },
        {
            primary: t("navWebsite"),
            icon: MonitorSmartphone,
            children: [
                { primary: t("pages"), pathname: "/admin/pages" },
                { primary: t("banners"), pathname: "/admin/banners" },
                { primary: t("sections"), pathname: "/admin/sections" },
            ],
        },
        {
            primary: t("navMessages"),
            icon: MessagesSquare,
            children: [
                { primary: t("contactMessages"), pathname: "/admin/contact" },
                { primary: t("subscribers"), pathname: "/admin/subscribers" },
            ],
        },
        {
            primary: t("settings"),
            icon: Settings,
            children: [
                { primary: t("generalSettings"), pathname: "/admin/settings", exact: true },
                { primary: t("mailSettings"), pathname: "/admin/settings/mail" },
                { primary: t("activityLog"), pathname: "/admin/activity" },
            ],
        },
        ...(isSuper ? [{
            primary: t("database"),
            pathname: "/admin/database",
            icon: Database,
        }] : []),
    ], [t, isSuper]);

    return linksList
}
