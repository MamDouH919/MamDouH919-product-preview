import React, { useContext } from "react";
import {
    Divider,
    Drawer,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Stack,
    useMediaQuery,
} from "@mui/material";
import { styled, useTheme } from "@mui/material/styles";
import {
    SpaceDashboard
} from "@mui/icons-material";
import clsx from "clsx";
import { DRAWER_WIDTH } from "@/lib/constant";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useLinksList } from "./NavLinks";
import { DashboardDrawerContext } from "@/context/Contexts";
import CustomLink from "@/components/CustomLink";
// import ChangePassword from "../dialogs/ChangePassword";

const PREFIX = "NavDrawer";

const classes = {
    listItemFocus: `${PREFIX}-listItemFocus`,
    navLink: `${PREFIX}-navLink`,
    nestedListItem: `${PREFIX}-nestedListItem`,
    navSubItem: `${PREFIX}-navSubItem`,

    firstLetterCapital: `${PREFIX}-firstLetterCapital`,
    dashboardListItem: `${PREFIX}-dashboardListItem`,
};


const ListStyle = styled(List)(({ theme }) => ({
    padding: theme.spacing(1),
    height: "calc(100vh - 120px)",
    overflow: "auto",
}))

// TODO jss-to-styled codemod: The Fragment root was replaced by div. Change the tag if needed.
const Root = styled(Drawer)(({ theme }) => ({
    width: DRAWER_WIDTH,
    flexShrink: 0,
    '& .MuiDrawer-paper': {
        width: DRAWER_WIDTH,
        boxSizing: 'border-box',
        zIndex: 1199,
    },

    [`& .${classes.navLink}`]: {
        textDecoration: "none",
        color: theme.palette.text.primary,
    },

    [`& .${classes.dashboardListItem}`]: {
        margin: theme.spacing(2, 0),
    },
    [`& .${classes.navSubItem}`]: {
        padding: theme.spacing(0, 0.5),
        minWidth: "20px !important",
    },




    [`& .${classes.listItemFocus}`]: {
        backgroundColor: theme.palette.divider,
        // color: theme.palette.getContrastText(theme.palette.primary.main),
        // "& svg": {
        //     color: theme.palette.getContrastText(theme.palette.primary.main),
        // },
    },
    [`& .${classes.firstLetterCapital}`]: {
        "&:first-letter": {
            textTransform: "capitalize",
        },
    },
}));

const ItemButtonStyle = styled(ListItemButton)(({ theme }) => ({
    padding: theme.spacing(0.5, 1),
    borderRadius: theme.spacing(1),
    // transition: "all 0.1s ease", // <--- Add transition here
    "& svg, & span": {
        transition: "color 0.3s ease", // <--- Optional: smooth color transition
    },

    ["&:hover"]: {
        // backgroundColor: theme.palette.primary.main,
        // color: theme.palette.getContrastText(theme.palette.primary.main),
        "& svg": {
            // color: theme.palette.getContrastText(theme.palette.primary.main),
        },
    },
}));

const DrawerHeader = styled('div')(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(0, 1.5),
    // necessary for content to be below app bar
    ...theme.mixins.toolbar,
    justifyContent: 'flex-end',
}));

const NavDrawer: React.FC = () => {
    const { t } = useTranslation()
    const linksList = useLinksList()
    const pathname = usePathname();

    const context = useContext(DashboardDrawerContext);
    const theme = useTheme()
    const isScreenSmall = useMediaQuery(theme.breakpoints.down("sm"))

    console.log(isScreenSmall);
    


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
            <ListStyle>
                <CustomLink
                    href={"/admin"}
                    className={clsx(classes.navLink)}
                    onClick={handleCloseNavDrawer}
                >
                    <ItemButtonStyle
                        className={clsx(classes.dashboardListItem, {
                            [classes.listItemFocus]:
                                pathname.split("/").length === 3
                        })}
                    >
                        <ListItemIcon className={classes.navSubItem}>
                            <SpaceDashboard />
                        </ListItemIcon>
                        <ListItemText primary={t("dashboard")} className={classes.firstLetterCapital} />
                    </ItemButtonStyle>
                </CustomLink>
                <Stack spacing={1.5}>
                    {linksList.map((e) => {
                        return (
                            <CustomLink
                                href={e.pathname || ""}
                                className={clsx(classes.navLink)}
                                key={e.primary}
                                onClick={handleCloseNavDrawer}
                            >
                                <ItemButtonStyle
                                    className={clsx({
                                        [classes.listItemFocus]:
                                            pathname.includes(e.pathname || "")
                                    })}
                                >
                                    <ListItemIcon className={classes.navSubItem}>
                                        {e.icon && <e.icon />}
                                    </ListItemIcon>
                                    <ListItemText primary={e.primary} />
                                </ItemButtonStyle>
                            </CustomLink>
                        )
                    })}
                </Stack>
            </ListStyle>
            {/* <Stack
                position={"absolute"}
                bottom={0}
                right={0}
                width={"100%"}
                height={"50px"}
                justifyContent={"center"}
                alignItems={"center"}
                borderTop={(theme) => `1px solid ${theme.palette.divider}`}
            >
                <ChangePassword />
            </Stack> */}
        </Root>
    );
};

export default NavDrawer;
