import React, { useContext, useState } from "react";
import {
    Box,
    ButtonBase,
    Collapse,
    Divider,
    Drawer,
    Stack,
    Typography,
    useMediaQuery,
} from "@mui/material";
import { alpha, styled, useTheme } from "@mui/material/styles";
import { ChevronDown } from "lucide-react";
import { DRAWER_WIDTH } from "@/lib/constant";
import { usePathname } from "next/navigation";
import { LinkItem, useLinksList } from "./NavLinks";
import { DashboardDrawerContext } from "@/context/Contexts";
import CustomLink from "@/components/CustomLink";

const TILE = 40;
const ROW_PADDING = 8;
// The sub-link guide line runs under the centre of the group's icon tile.
const GUIDE_OFFSET = ROW_PADDING + TILE / 2;

const Root = styled(Drawer)(({ theme }) => ({
    width: DRAWER_WIDTH,
    flexShrink: 0,
    '& .MuiDrawer-paper': {
        width: DRAWER_WIDTH,
        boxSizing: 'border-box',
        zIndex: 1199,
        borderInlineEnd: `1px solid ${theme.palette.divider}`,
    },
    "& a": { textDecoration: "none", color: "inherit" },
}));

const DrawerHeader = styled('div')(({ theme }) => ({
    ...theme.mixins.toolbar,
}));

const Row = styled(ButtonBase, {
    shouldForwardProp: (p) => p !== "active",
})<{ active?: boolean; component?: React.ElementType }>(({ theme, active }) => ({
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
    padding: ROW_PADDING,
    borderRadius: 14,
    textAlign: "start",
    color: active ? theme.palette.primary.main : theme.palette.text.primary,
    transition: "background-color .2s ease",
    "&:hover": { backgroundColor: theme.palette.action.hover },
    "&:hover .nav-tile": {
        backgroundColor: active ? theme.palette.primary.main : alpha(theme.palette.text.primary, 0.08),
    },
}));

const Tile = styled("span", {
    shouldForwardProp: (p) => p !== "active",
})<{ active?: boolean }>(({ theme, active }) => ({
    width: TILE,
    height: TILE,
    flexShrink: 0,
    borderRadius: 12,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: active ? theme.palette.primary.contrastText : theme.palette.text.secondary,
    backgroundColor: active ? theme.palette.primary.main : alpha(theme.palette.text.primary, 0.05),
    boxShadow: active ? `0 6px 14px ${alpha(theme.palette.primary.main, 0.3)}` : "none",
    transition: "background-color .2s ease, color .2s ease, box-shadow .2s ease",
}));

const SubList = styled(Box)(({ theme }) => ({
    position: "relative",
    paddingInlineStart: theme.spacing(1.25),
    borderInlineStart: `1.5px solid ${theme.palette.divider}`,
    margin: theme.spacing(0.5, 0, 1),
    marginInlineStart: GUIDE_OFFSET,
}));

const SubRow = styled("span", {
    shouldForwardProp: (p) => p !== "active",
})<{ active?: boolean }>(({ theme, active }) => ({
    position: "relative",
    display: "block",
    padding: theme.spacing(1, 2),
    borderRadius: 999,
    fontSize: "0.875rem",
    fontWeight: active ? 600 : 500,
    color: active ? theme.palette.primary.main : theme.palette.text.primary,
    backgroundColor: active ? alpha(theme.palette.primary.main, 0.1) : "transparent",
    transition: "background-color .2s ease, color .2s ease",
    "&:hover": {
        color: theme.palette.primary.main,
        backgroundColor: active ? alpha(theme.palette.primary.main, 0.1) : theme.palette.action.hover,
    },
    // Marker sitting on the guide line beside the active link
    "&::before": {
        content: '""',
        position: "absolute",
        top: "50%",
        insetInlineStart: `calc(-${theme.spacing(1.25)} - 2.25px)`,
        width: 3,
        height: active ? 20 : 0,
        borderRadius: 3,
        backgroundColor: theme.palette.primary.main,
        transform: "translateY(-50%)",
        transition: "height .2s ease",
    },
}));

const Label = ({ children }: { children: React.ReactNode }) => (
    <Typography component="span" fontWeight={600} fontSize="0.925rem" noWrap sx={{ flex: 1, minWidth: 0 }}>
        {children}
    </Typography>
);

const NavDrawer: React.FC = () => {
    const linksList = useLinksList()
    const pathname = usePathname();

    const context = useContext(DashboardDrawerContext);
    const theme = useTheme()
    const isScreenSmall = useMediaQuery(theme.breakpoints.down("sm"))

    // Path without the locale prefix: "/en/admin/orders/1" -> "/admin/orders/1"
    const route = pathname.replace(/^\/[^/]+/, "") || "/";
    const isActive = (link: LinkItem) =>
        !!link.pathname &&
        (link.exact ? route === link.pathname : route === link.pathname || route.startsWith(link.pathname + "/"));

    const activeGroup = linksList.find((l) => l.children?.some(isActive))?.primary ?? null;

    // Open the group holding the current page whenever the route changes;
    // otherwise the user's own expand/collapse choice wins.
    const [openGroup, setOpenGroup] = useState<string | null>(activeGroup);
    const [prevRoute, setPrevRoute] = useState(route);
    if (route !== prevRoute) {
        setPrevRoute(route);
        if (activeGroup) setOpenGroup(activeGroup);
    }

    const handleCloseNavDrawer = () => {
        if (isScreenSmall) {
            context?.dispatch({ type: "SET_OPEN", payload: false });
        }
    };

    return (
        <Root
            variant={isScreenSmall ? "temporary" : "persistent"}
            anchor="left"
            open={context?.open}
            onClose={handleCloseNavDrawer}
        >
            <DrawerHeader />
            <Divider />
            <Stack component="nav" spacing={0.5} sx={{ p: 1.5, height: "calc(100vh - 120px)", overflowY: "auto" }}>
                {linksList.map((link) => {
                    const Icon = link.icon;

                    if (!link.children) {
                        const active = isActive(link);
                        return (
                            <CustomLink key={link.primary} href={link.pathname ?? ""} onClick={handleCloseNavDrawer}>
                                <Row component="span" active={active} tabIndex={-1}>
                                    <Tile className="nav-tile" active={active}>
                                        {Icon && <Icon size={20} strokeWidth={1.8} />}
                                    </Tile>
                                    <Label>{link.primary}</Label>
                                </Row>
                            </CustomLink>
                        );
                    }

                    const groupActive = activeGroup === link.primary;
                    const open = openGroup === link.primary;
                    return (
                        <Box key={link.primary}>
                            <Row
                                active={groupActive}
                                onClick={() => setOpenGroup(open ? null : link.primary)}
                                aria-expanded={open}
                            >
                                <Tile className="nav-tile" active={groupActive}>
                                    {Icon && <Icon size={20} strokeWidth={1.8} />}
                                </Tile>
                                <Label>{link.primary}</Label>
                                <ChevronDown
                                    size={18}
                                    style={{
                                        flexShrink: 0,
                                        color: theme.palette.text.secondary,
                                        transition: "transform .25s ease",
                                        transform: open ? "rotate(180deg)" : "none",
                                    }}
                                />
                            </Row>
                            <Collapse in={open} timeout={250}>
                                <SubList>
                                    <Stack spacing={0.25}>
                                        {link.children.map((child) => (
                                            <CustomLink
                                                key={child.pathname}
                                                href={child.pathname ?? ""}
                                                onClick={handleCloseNavDrawer}
                                            >
                                                <SubRow active={isActive(child)}>{child.primary}</SubRow>
                                            </CustomLink>
                                        ))}
                                    </Stack>
                                </SubList>
                            </Collapse>
                        </Box>
                    );
                })}
            </Stack>
        </Root>
    );
};

export default NavDrawer;
