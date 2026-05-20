import Typography from "@mui/material/Typography";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import { styled } from "@mui/material/styles";
import { Box, Stack } from "@mui/material";
import useDashboard from "@/Hooks/useDashboard";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import CustomLink from "@/components/CustomLink";


const LinkStyle = styled(Link)(({ theme }) => ({
    textDecoration: "none",
    transition: "all 0.2s ease-in-out",
    color: theme.palette.primary.main,
    "&:hover": {
        textDecoration: "underline",

    },
}));

const Breadcrumb = ({
    actions,
    links
}: {
    links: {
        name: string;
        href?: string;
    }[]
    actions?: React.ReactNode
}) => {
    const { t } = useTranslation()
    const context = useDashboard();


    return (
        <Stack
            direction={"row"}
            alignItems={"center"}
            justifyContent={"space-between"}
            px={2}
            bgcolor={"background.paper"}
            borderBottom={1}
            borderColor={"divider"}
            height={"40px"}
        >
            <Breadcrumbs aria-label="breadcrumb">
                {/* Set condition here to display it only if there is a landing page */}
                {/* <Link
                    color="inherit"
                    href="/"
                >
                    {"home"}
                </Link> */}

                <CustomLink
                    href="/dashboard"
                >
                    {t("dashboard")}
                </CustomLink>

                {links.map((link, index) => (
                    link.href ? <CustomLink
                        key={index}
                        href={link.href}
                    >
                        {link.name}
                    </CustomLink>
                    : <Typography key={index}>{link.name}</Typography>
                ))}
            </Breadcrumbs>
            {actions && <Box>
                {actions}
            </Box>}
        </Stack>
    );
};

export default Breadcrumb;