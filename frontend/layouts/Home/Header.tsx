"use client";

import {
  Box,
  Container,
  Drawer,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import { styled, useTheme } from "@mui/material/styles";
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { LogoWrapper } from "@/utils/global.style";
import CustomLink from "@/components/CustomLink";
import { useAppSelector } from "@/Store/store";
import { getBackendUri } from "@/utils/helperFunctions";
import LanguageIcon from "@/components/LanguageIcon";

// ── Styled ───────────────────────────────────────────────────────────────────

const HeaderBar = styled(Box, {
  shouldForwardProp: (p) => p !== "scrolled",
})<{ scrolled: boolean }>(({ theme, scrolled }) => ({
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  zIndex: theme.zIndex.appBar,
  height: 70,
  display: "flex",
  alignItems: "center",
  transition: "background 0.35s ease, box-shadow 0.35s ease",
  background: scrolled
    ? theme.palette.background.paper
    : "transparent",
  boxShadow: scrolled
    ? "0 2px 16px rgba(0,0,0,0.08)"
    : "none",
}));

const NavLink = styled("span", {
  shouldForwardProp: (p) => p !== "active" && p !== "scrolled",
})<{ active?: boolean; scrolled: boolean }>(
  ({ theme, active, scrolled }) => ({
    position: "relative",
    fontWeight: 500,
    fontSize: "0.9375rem",
    cursor: "pointer",
    whiteSpace: "nowrap",
    textDecoration: "none",
    color: !scrolled
      ? "#fff"
      : active
        ? theme.palette.primary.main
        : theme.palette.text.primary,
    transition: "color 0.25s ease",
    paddingBottom: 2,
    "&::after": {
      content: '""',
      position: "absolute",
      bottom: -4,
      left: 0,
      width: active ? "100%" : "0%",
      height: 2,
      backgroundColor: !scrolled
        ? "#fff"
        : theme.palette.primary.main,
      transition: "width 0.25s ease",
      borderRadius: 2,
    },
    "&:hover": {
      color: !scrolled ? "rgba(255,255,255,0.8)" : theme.palette.primary.main,
    },
    "&:hover::after": { width: "100%" },
  })
);

// ── Component ────────────────────────────────────────────────────────────────

const Navbar = () => {
  const { t } = useTranslation();
  const pathname = usePathname();
  const newPathname = pathname.split("/")[2] ? "/" + pathname.split("/")[2] : "/";

  const isHomePage = newPathname === "/";
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const { logo } = useAppSelector((state) => state.settings);
  // On inner pages the header is always "scrolled" (solid/dark) unless the user scrolls
  const isTransparent = isHomePage && !scrolled;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { href: "/", label: t("home") },
    { href: "/teams", label: t("ourTeam") },
    { href: "/news", label: t("news") },
    { href: "/join-us", label: t("joinUs") },
    { href: "/about", label: t("aboutUs") },
    { href: "/contact", label: t("contactUs") },
  ];


  return (
    <>
      <HeaderBar scrolled={!isTransparent}>
        <Container maxWidth="lg">
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            {/* Logo */}
            <CustomLink href="/">
              <LogoWrapper>
                <Image
                  src={"/logo.webp"}
                  alt="logo"
                  width={0}
                  height={60}
                  style={{ width: "auto", height: "100%" }}
                  priority
                  unoptimized
                />
              </LogoWrapper>
            </CustomLink>

            {/* Desktop nav */}
            {/* <Stack
              direction="row"
              alignItems="center"
              spacing={4}
              sx={{ display: { xs: "none", md: "flex" } }}
            >
              {links.map((link) => (
                <CustomLink key={link.href} href={link.href} style={{ textDecoration: "none" }}>
                  <NavLink
                    active={newPathname === link.href}
                    scrolled={!isTransparent}
                  >
                    {link.label}
                  </NavLink>
                </CustomLink>
              ))}
            </Stack> */}

            {/* Right: language + mobile toggle */}
            <Stack direction="row" alignItems="center" spacing={1}>
              <Box sx={{ color: isTransparent ? "#fff" : "inherit" }}>
              </Box>
              <LanguageIcon />
              {/* <IconButton
                onClick={() => setMobileOpen(true)}
                sx={{
                  display: { md: "none" },
                  // color: isTransparent ? "#fff" : theme.palette.text.primary,
                }}
              >
                <MenuIcon />
              </IconButton> */}
            </Stack>
          </Stack>
        </Container>
      </HeaderBar>


      {/* Mobile drawer */}
      <Drawer
        anchor="right"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        PaperProps={{ sx: { width: 300, pt: 2 } }}
      >
        <Stack px={2} pb={2}>
          <Stack direction="row" justifyContent="flex-end" mb={2}>
            <IconButton onClick={() => setMobileOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Stack>

          {links.map((link) => (
            <CustomLink key={link.href} href={link.href} style={{ textDecoration: "none" }}>
              <Typography
                variant="body1"
                fontWeight={newPathname === link.href ? 700 : 500}
                color={newPathname === link.href ? "primary" : "text.primary"}
                py={1.5}
                px={1}
                sx={{ borderBottom: "1px solid", borderColor: "divider" }}
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Typography>
            </CustomLink>
          ))}

          <Box mt={2}>
            <LanguageIcon />
          </Box>
        </Stack>
      </Drawer>

    </>
  );
};

export default Navbar;
