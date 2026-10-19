'use client';

import type { ReactNode } from 'react';
import {
  Box,
  Container,
  Divider,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import LocationOnOutlined from '@mui/icons-material/LocationOnOutlined';
import PhoneOutlined from '@mui/icons-material/PhoneOutlined';
import EmailOutlined from '@mui/icons-material/EmailOutlined';
import WhatsApp from '@mui/icons-material/WhatsApp';
import { useAppSelector } from '@/Store/store';
import { getBackendUri, getLocalizedString } from '@/utils/helperFunctions';
import { useSettingsQuery } from '@/backend-api/settings/hooks';
import { useCategoriesQuery } from '@/backend-api/categories/hooks';
import { usePagesNavigationQuery } from '@/backend-api/pages/hooks';
import { useCurrency } from '@/Hooks/useCurrency';
import CustomLink from '@/components/CustomLink';
import SocialMediaLinks from '@/components/Social';
import NewsletterForm from '@/components/NewsletterForm';

const navLink = {
  display: 'block',
  color: 'text.secondary',
  textDecoration: 'none',
  fontSize: '0.875rem',
  lineHeight: 2.2,
  transition: 'color 0.15s ease',
  '&:hover': { color: 'primary.main' },
};

const ColumnTitle = ({ children }: { children: ReactNode }) => (
  <Typography
    sx={{
      fontSize: '0.95rem',
      fontWeight: 700,
      color: 'text.primary',
      mb: 2,
    }}
  >
    {children}
    <Box
      component="span"
      sx={{
        display: 'block',
        width: 28,
        height: 3,
        borderRadius: 3,
        bgcolor: 'primary.main',
        mt: 1,
        mx: { xs: 'auto', sm: 0 },
      }}
    />
  </Typography>
);

const ContactRow = ({
  icon,
  href,
  label,
}: {
  icon: ReactNode;
  href: string;
  label: string;
}) => (
  <Box
    component="a"
    href={href}
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1,
      color: 'text.secondary',
      textDecoration: 'none',
      fontSize: '0.85rem',
      transition: 'color 0.15s ease',
      '&:hover': { color: 'primary.main' },
    }}
  >
    {icon}
    {label}
  </Box>
);

const Footer = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const { logo } = useAppSelector((state) => state.settings);
  const { data: settings } = useSettingsQuery();
  const { data: categories } = useCategoriesQuery();
  const { data: navPages } = usePagesNavigationQuery();
  const currency = useCurrency();

  const socialLinks = (settings?.socialMedia ?? []).filter((s) => s.value);
  const description = getLocalizedString(settings?.siteDescription, lang);
  const siteName = getLocalizedString(settings?.siteTitle, lang);

  const shopCategories = (categories ?? [])
    .filter((c) => c.isActive)
    .sort((a, b) => a.order - b.order)
    .slice(0, 5);

  const whatsappHref = settings?.whatsapp
    ? `https://wa.me/${settings.whatsapp.replace(/\D/g, '')}`
    : null;

  const quickLinks = [
    { href: '/', label: t('home') },
    // { href: '/about', label: t('aboutUs') },
    ...(navPages ?? [])
      .filter((p) => p.showInFooter)
      .map((p) => ({ href: `/${p.slug}`, label: getLocalizedString(p.title, lang) })),
    { href: '/contact', label: t('contactUs') },
  ];

  return (
    <Box
      component="footer"
      sx={{
        mt: 'auto',
        borderTop: '1px solid',
        borderColor: 'divider',
        backgroundColor: (th) => alpha(th.palette.primary.main, 0.035),
        backgroundImage: (th) =>
          `linear-gradient(180deg, ${alpha(th.palette.primary.main, 0.06)}, transparent 220px)`,
      }}
    >
      <Container maxWidth="lg" sx={{ pt: { xs: 6, md: 8 }, pb: 4 }}>
        <Grid container spacing={{ xs: 5, sm: 4, md: 6 }}>
          {/* Brand */}
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Stack
              spacing={2}
              alignItems={{ xs: 'center', sm: 'flex-start' }}
              textAlign={{ xs: 'center', sm: 'start' }}
            >
              {logo ? (
                <Image
                  src={getBackendUri(logo)}
                  alt={siteName || 'logo'}
                  width={0}
                  height={44}
                  unoptimized
                  style={{ width: 'auto', height: 44, maxWidth: 170 }}
                />
              ) : (
                siteName && (
                  <Typography variant="h6" fontWeight={800}>
                    {siteName}
                  </Typography>
                )
              )}
              {description && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontSize: '0.85rem', lineHeight: 1.8, maxWidth: 260 }}
                >
                  {description}
                </Typography>
              )}
            </Stack>
          </Grid>

          {/* Quick links */}
          <Grid size={{ xs: 6, sm: 6, md: 3 }}>
            <Box textAlign={{ xs: 'center', sm: 'start' }}>
              <ColumnTitle>{t('quickLinks')}</ColumnTitle>
              <Stack component="nav">
                {quickLinks.map((link) => (
                  <Box
                    key={link.href}
                    component={CustomLink}
                    href={link.href}
                    sx={navLink}
                  >
                    {link.label}
                  </Box>
                ))}
              </Stack>
            </Box>
          </Grid>

          {/* Shop */}
          <Grid size={{ xs: 6, sm: 6, md: 3 }}>
            <Box textAlign={{ xs: 'center', sm: 'start' }}>
              <ColumnTitle>{t('shopByCategory')}</ColumnTitle>
              <Stack component="nav">
                <Box
                  component={CustomLink}
                  href="/products"
                  sx={{ ...navLink, fontWeight: 600 }}
                >
                  {t('allProducts')}
                </Box>
                {shopCategories.map((cat) => (
                  <Box
                    key={cat._id}
                    component={CustomLink}
                    href={`/categories/${cat.slug}`}
                    sx={navLink}
                  >
                    {getLocalizedString(cat.name, lang)}
                  </Box>
                ))}
                <Box component={CustomLink} href="/categories" sx={navLink}>
                  {t('allCategories')}
                </Box>
              </Stack>
            </Box>
          </Grid>

          {/* Contact */}
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Box textAlign={{ xs: 'center', sm: 'start' }}>
              <ColumnTitle>{t('getInTouch')}</ColumnTitle>
              <Stack spacing={1.4} alignItems={{ xs: 'center', sm: 'flex-start' }}>
                {settings?.address && (
                  <Stack direction="row" spacing={1} alignItems="flex-start">
                    <LocationOnOutlined
                      aria-hidden="true"
                      sx={{ fontSize: 18, color: 'primary.main', mt: '2px' }}
                    />
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ fontSize: '0.85rem', textAlign: { xs: 'center', sm: 'start' } }}
                    >
                      {settings.address}
                    </Typography>
                  </Stack>
                )}
                {settings?.phone && (
                  <ContactRow
                    icon={
                      <PhoneOutlined
                        aria-hidden="true"
                        sx={{ fontSize: 18, color: 'primary.main' }}
                      />
                    }
                    href={`tel:${settings.phone}`}
                    label={settings.phone}
                  />
                )}
                {settings?.email && (
                  <ContactRow
                    icon={
                      <EmailOutlined
                        aria-hidden="true"
                        sx={{ fontSize: 18, color: 'primary.main' }}
                      />
                    }
                    href={`mailto:${settings.email}`}
                    label={settings.email}
                  />
                )}
                {whatsappHref && (
                  <Box
                    component="a"
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{
                      mt: 0.5,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.75,
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: '#25D366',
                      textDecoration: 'none',
                      border: '1px solid',
                      borderColor: alpha('#25D366', 0.4),
                      borderRadius: 999,
                      px: 1.5,
                      py: 0.5,
                      transition: 'background-color 0.15s ease',
                      '&:hover': { bgcolor: alpha('#25D366', 0.08) },
                    }}
                  >
                    <WhatsApp aria-hidden="true" sx={{ fontSize: 16 }} />
                    {t('chatOnWhatsApp')}
                  </Box>
                )}
              </Stack>
            </Box>
          </Grid>
        </Grid>

        {/* Newsletter */}
        <Box
          sx={{
            mt: { xs: 6, md: 8 },
            p: { xs: 3, md: 4 },
            borderRadius: 3,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            maxWidth: 640,
            mx: 'auto',
          }}
        >
          <NewsletterForm />
        </Box>

        {/* Social */}
        {socialLinks.length > 0 && (
          <Box sx={{ mt: { xs: 6, md: 8 } }}>
            <Divider sx={{ mb: 4 }} />
            <Typography
              textAlign="center"
              sx={{ fontSize: '0.8rem', fontWeight: 700, color: 'text.secondary', mb: 1 }}
            >
              {t('followUs')}
            </Typography>
            <SocialMediaLinks
              links={socialLinks.map((s) => ({ code: s.key, link: s.value }))}
            />
          </Box>
        )}

        <Divider sx={{ mt: socialLinks.length > 0 ? 2 : 6, mb: 3 }} />

        {/* Bottom bar */}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          alignItems="center"
          justifyContent="space-between"
        >
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ fontSize: '0.8rem' }}
            textAlign="center"
          >
            © {new Date().getFullYear()} -{' '}
            <a href="https://mamdouh.mountain-egy.site/" target="_blank" rel="noopener noreferrer">
              Mamdouh Mohamed
            </a>{' '}
            — {t('allRightsReserved')}
          </Typography>
          {currency && (
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.78rem' }}>
              {t('priceInCurrency', { currency })}
            </Typography>
          )}
        </Stack>
      </Container>
    </Box>
  );
};

export default Footer;
