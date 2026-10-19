"use client";

import {
  Box,
  Collapse,
  Container,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import { alpha, styled } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import MenuIcon from "@mui/icons-material/Menu";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { LogoWrapper } from "@/utils/global.style";
import CustomLink from "@/components/CustomLink";
import { useAppSelector } from "@/Store/store";
import { getBackendUri } from "@/utils/helperFunctions";
import LanguageIcon from "@/components/LanguageIcon";
import AccountMenu from "@/components/AccountMenu";
import CartButton from "@/components/CartButton";
import SearchButton from "@/components/SearchButton";
import { useCategoriesQuery } from "@/backend-api/categories/hooks";
import { usePagesNavigationQuery } from "@/backend-api/pages/hooks";
import { LocalizedField } from "@/backend-api/globalTypes";

// ── Styled ───────────────────────────────────────────────────────────────────

const HeaderWrapper = styled(Box)(({ theme }) => ({
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  zIndex: theme.zIndex.appBar,
  paddingTop: 14,
  pointerEvents: "none",
  [theme.breakpoints.down("md")]: { paddingTop: 10 },
}));

const HeaderCard = styled(Box, {
  shouldForwardProp: (p) => p !== "scrolled" && p !== "menuOpen",
})<{ scrolled: boolean; menuOpen?: boolean }>(({ theme, scrolled, menuOpen }) => ({
  pointerEvents: "auto",
  position: "relative",
  padding: theme.spacing(0, 3),
  borderRadius: 20,
  border: `1px solid ${alpha("#fff", 0.6)}`,
  // Solid enough while the mobile menu is open for the links to stay readable
  background: menuOpen ? alpha(theme.palette.background.paper, 0.94) : undefined,
  backdropFilter: "blur(18px) saturate(160%)",
  WebkitBackdropFilter: "blur(18px) saturate(160%)",
  boxShadow: scrolled
    ? `0 12px 32px ${alpha(theme.palette.primary.dark, 0.16)}`
    : `0 6px 20px ${alpha(theme.palette.primary.dark, 0.08)}`,
  transition: "box-shadow 0.35s ease, background 0.35s ease",
  [theme.breakpoints.down("md")]: {
    padding: theme.spacing(0, 1.5),
    borderRadius: 16,
  },
}));

const HeaderRow = styled(Box)(({ theme }) => ({
  height: 76,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: theme.spacing(2),
  [theme.breakpoints.down("md")]: { height: 64 },
}));

// Mobile menu links fade/slide in one after another as the curtain drops
const MobileMenu = styled(Box, {
  shouldForwardProp: (p) => p !== "open",
})<{ open: boolean }>(({ open }) => ({
  maxHeight: "calc(100dvh - 110px)",
  overflowY: "auto",
  "& > .mobile-item": {
    opacity: open ? 1 : 0,
    transform: open ? "translateY(0)" : "translateY(-10px)",
    transition: "opacity 0.35s ease, transform 0.35s ease",
    // Each item sets --i (its index) so the stagger avoids :nth-child (unsafe with SSR)
    transitionDelay: open ? "calc(0.08s + var(--i, 0) * 0.05s)" : "0s",
  },
}));

const NavItem = styled("span", {
  shouldForwardProp: (p) => p !== "active",
})<{ active?: boolean }>(({ theme, active }) => ({
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
  gap: 2,
  padding: theme.spacing(1, 0.5),
  fontWeight: active ? 600 : 500,
  fontSize: "0.8rem",
  whiteSpace: "nowrap",
  cursor: "pointer",
  color: active ? theme.palette.primary.main : theme.palette.text.primary,
  transition: "color 0.25s ease",
  "&::after": {
    content: '""',
    position: "absolute",
    bottom: -2,
    insetInlineStart: 0,
    width: active ? "100%" : "0%",
    height: 3,
    borderRadius: 3,
    backgroundColor: theme.palette.primary.main,
    transition: "width 0.3s ease",
  },
  "&:hover": { color: theme.palette.primary.main },
  "&:hover::after": { width: "100%" },
}));

// Dropdown opens on hover and on keyboard focus (focus-within).
const Dropdown = styled(Box)(({ theme }) => ({
  position: "relative",
  // Symmetric offsets keep the panel centred regardless of text direction.
  "& .dropdown-panel": {
    position: "absolute",
    top: "100%",
    left: -200,
    right: -200,
    display: "flex",
    justifyContent: "center",
    paddingTop: 14,
    pointerEvents: "none",
    opacity: 0,
    visibility: "hidden",
    transform: "translateY(8px)",
    transition: "opacity 0.2s ease, transform 0.2s ease, visibility 0.2s",
  },
  "&:hover .dropdown-panel, &:focus-within .dropdown-panel": {
    opacity: 1,
    visibility: "visible",
    transform: "translateY(0)",
  },
  "&:hover .dropdown-card, &:focus-within .dropdown-card": {
    pointerEvents: "auto",
  },
  // Invisible bridge over the gap so hover isn't lost moving down to the card
  "&:hover::after": {
    content: '""',
    position: "absolute",
    left: 0,
    right: 0,
    top: "100%",
    height: 16,
  },
  "&:hover .dropdown-arrow, &:focus-within .dropdown-arrow": {
    transform: "rotate(180deg)",
  },
  "& .dropdown-arrow": { transition: "transform 0.25s ease", fontSize: 20 },
  "& .dropdown-card": {
    position: "relative",
    minWidth: 240,
    maxHeight: 380,
    overflowY: "auto",
    padding: theme.spacing(1),
    borderRadius: 16,
    background: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: `0 18px 40px ${alpha(theme.palette.primary.dark, 0.18)}`,
  },
}));

const DropdownLink = styled("span")(({ theme }) => ({
  display: "block",
  padding: theme.spacing(1.1, 1.5),
  borderRadius: 10,
  fontSize: "0.8rem",
  fontWeight: 500,
  color: theme.palette.text.primary,
  transition: "background 0.2s ease, color 0.2s ease, padding 0.2s ease",
  "&:hover": {
    background: alpha(theme.palette.primary.main, 0.08),
    color: theme.palette.primary.main,
    paddingInlineStart: theme.spacing(2.25),
  },
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

const localized = (field: LocalizedField | undefined, lang: string) =>
  field ? field[lang] || field["ar"] || field["en"] || "" : "";

// ── Component ────────────────────────────────────────────────────────────────

const Navbar = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const pathname = usePathname();
  const newPathname = pathname.split("/")[2]
    ? "/" + pathname.split("/")[2]
    : "/";

  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileCatsOpen, setMobileCatsOpen] = useState(false);

  const { logo } = useAppSelector((state) => state.settings);
  const { data: categoriesData } = useCategoriesQuery();
  const categories = (categoriesData ?? [])
    .filter((c) => c.isActive)
    .sort((a, b) => a.order - b.order);
  const { data: navPages } = usePagesNavigationQuery();
  const headerPages = (navPages ?? []).filter((p) => p.showInHeader);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { href: "/", label: t("home") },
    { href: "/products", label: t("products") },
    { href: "/categories", label: t("categories"), dropdown: true },
    ...headerPages.map((p) => ({ href: `/${p.slug}`, label: localized(p.title, lang) })),
    { href: "/contact", label: t("contactUs") },
  ];

  return (
    <>
      <HeaderWrapper>
        <Container maxWidth="xl">
          <HeaderCard scrolled={scrolled || mobileOpen} menuOpen={mobileOpen}>
            <HeaderRow>
              {/* Logo */}
              <CustomLink href="/" ariaLabel="home">
                <LogoWrapper sx={{ height: { xs: 44, md: 56 } }}>
                  <Image
                    src={getBackendUri(logo) ?? "/images/placeholder.png"}
                    alt="logo"
                    width={0}
                    height={56}
                    style={{ width: "auto", height: "100%" }}
                    priority
                    unoptimized
                  />
                </LogoWrapper>
              </CustomLink>

              {/* Desktop nav */}
              <Stack
                component="nav"
                direction="row"
                alignItems="center"
                spacing={{ md: 3, lg: 4.5 }}
                useFlexGap
                sx={{ display: { xs: "none", md: "flex" } }}
              >
                {links.map((link) =>
                  link.dropdown ? (
                    <Dropdown key={link.href}>
                      <CustomLink
                        href={link.href}
                        style={{ textDecoration: "none" }}
                      >
                        <NavItem active={newPathname === link.href}>
                          {link.label}
                          <KeyboardArrowDownIcon className="dropdown-arrow" />
                        </NavItem>
                      </CustomLink>
                      {categories.length > 0 && (
                        <Box className="dropdown-panel">
                          <Box className="dropdown-card">
                            {categories.map((cat) => (
                              <CustomLink
                                key={cat._id}
                                href={`/categories/${cat.slug}`}
                                style={{ textDecoration: "none" }}
                              >
                                <DropdownLink>
                                  {localized(cat.name, lang)}
                                </DropdownLink>
                              </CustomLink>
                            ))}
                            <Box
                              sx={{
                                borderTop: 1,
                                borderColor: "divider",
                                mt: 0.5,
                                pt: 0.5,
                              }}
                            >
                              <CustomLink
                                href="/categories"
                                style={{ textDecoration: "none" }}
                              >
                                <DropdownLink
                                  sx={{
                                    color: "primary.main",
                                    fontWeight: 600,
                                  }}
                                >
                                  {t("allCategories")}
                                </DropdownLink>
                              </CustomLink>
                            </Box>
                          </Box>
                        </Box>
                      )}
                    </Dropdown>
                  ) : (
                    <CustomLink
                      key={link.href}
                      href={link.href}
                      style={{ textDecoration: "none" }}
                    >
                      <NavItem active={newPathname === link.href}>
                        {link.label}
                      </NavItem>
                    </CustomLink>
                  ),
                )}
              </Stack>

              {/* Actions */}
              <Stack
                direction="row"
                alignItems="center"
                spacing={{ xs: 0.25, md: 0.75 }}
              >
                <SearchButton />
                <Box sx={{ display: { xs: "none", sm: "block" } }}>
                  <LanguageIcon />
                </Box>
                <CartButton />
                <AccountMenu />
                <IconButton
                  onClick={() => setMobileOpen((o) => !o)}
                  aria-label={mobileOpen ? "close menu" : "open menu"}
                  aria-expanded={mobileOpen}
                  sx={{
                    display: { md: "none" },
                    transition: "transform 0.35s ease",
                    transform: mobileOpen ? "rotate(90deg)" : "none",
                  }}
                >
                  {mobileOpen ? <CloseIcon /> : <MenuIcon />}
                </IconButton>
              </Stack>
            </HeaderRow>

            {/* Mobile menu – drops down from the bottom of the header like a curtain */}
            <Collapse
              in={mobileOpen}
              timeout={450}
              easing={{
                enter: "cubic-bezier(0.22, 1, 0.36, 1)",
                exit: "cubic-bezier(0.4, 0, 1, 1)",
              }}
              sx={{ display: { md: "none" } }}
            >
              <MobileMenu
                open={mobileOpen}
                sx={{ borderTop: 1, borderColor: "divider", py: 1.5 }}
              >
                {links.map((link, index) => {
                  const active = newPathname === link.href;
                  const itemSx = {
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    py: 1.4,
                    px: 1.5,
                    mb: 0.5,
                    borderRadius: 2.5,
                    fontWeight: active ? 700 : 500,
                    color: active ? "primary.main" : "text.primary",
                    bgcolor: (theme: any) =>
                      active
                        ? alpha(theme.palette.primary.main, 0.08)
                        : "transparent",
                  };

                  if (link.dropdown) {
                    return (
                      <Box
                        key={link.href}
                        className="mobile-item"
                        style={{ "--i": index } as React.CSSProperties}
                      >
                        <Typography
                          component="button"
                          onClick={() => setMobileCatsOpen((o) => !o)}
                          sx={{
                            ...itemSx,
                            width: "100%",
                            border: 0,
                            font: "inherit",
                            cursor: "pointer",
                          }}
                        >
                          {link.label}
                          <KeyboardArrowDownIcon
                            sx={{
                              transition: "transform .25s",
                              transform: mobileCatsOpen
                                ? "rotate(180deg)"
                                : "none",
                            }}
                          />
                        </Typography>
                        <Collapse in={mobileCatsOpen}>
                          <Stack sx={{ pb: 1, paddingInlineStart: 2 }}>
                            {categories.map((cat) => (
                              <CustomLink
                                key={cat._id}
                                href={`/categories/${cat.slug}`}
                                style={{ textDecoration: "none" }}
                                onClick={() => setMobileOpen(false)}
                              >
                                <DropdownLink>
                                  {localized(cat.name, lang)}
                                </DropdownLink>
                              </CustomLink>
                            ))}
                            <CustomLink
                              href="/categories"
                              style={{ textDecoration: "none" }}
                              onClick={() => setMobileOpen(false)}
                            >
                              <DropdownLink
                                sx={{ color: "primary.main", fontWeight: 600 }}
                              >
                                {t("allCategories")}
                              </DropdownLink>
                            </CustomLink>
                          </Stack>
                        </Collapse>
                      </Box>
                    );
                  }

                  return (
                    <CustomLink
                      key={link.href}
                      href={link.href}
                      className="mobile-item"
                      style={
                        { textDecoration: "none", display: "block", "--i": index } as React.CSSProperties
                      }
                      onClick={() => setMobileOpen(false)}
                    >
                      <Typography sx={itemSx}>{link.label}</Typography>
                    </CustomLink>
                  );
                })}

                <Box
                  className="mobile-item"
                  style={{ "--i": links.length } as React.CSSProperties}
                  sx={{
                    display: { sm: "none" },
                    mt: 1,
                    pt: 1,
                    borderTop: 1,
                    borderColor: "divider",
                  }}
                >
                  <LanguageIcon />
                </Box>
              </MobileMenu>
            </Collapse>
          </HeaderCard>
        </Container>
      </HeaderWrapper>

      {/* Dim the page behind the open menu; tap to close */}
      <Box
        onClick={() => setMobileOpen(false)}
        sx={(theme) => ({
          display: { md: "none" },
          position: "fixed",
          inset: 0,
          zIndex: theme.zIndex.appBar - 1,
          bgcolor: alpha("#0b1530", 0.35),
          backdropFilter: "blur(2px)",
          opacity: mobileOpen ? 1 : 0,
          pointerEvents: mobileOpen ? "auto" : "none",
          transition: "opacity 0.35s ease",
        })}
      />
    </>
  );
};

export default Navbar;
