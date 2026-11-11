"use client";
import { ReactNode } from 'react';
import { Avatar, Box, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import LoginOutlined from '@mui/icons-material/LoginOutlined';
import { useTranslation } from 'react-i18next';
import Image from 'next/image';
import LanguageIcon from '@/components/LanguageIcon';
import { useAppSelector } from '@/Store/store';
import { getBackendUri, getLocalizedString } from '@/utils/helperFunctions';

/** The store's logo, or its initial when it has none yet. */
const StoreMark = ({ logo, name, size }: { logo?: string; name: string; size: number }) =>
  logo ? (
    <Box sx={{ position: 'relative', width: size * 2, height: size }}>
      <Image src={getBackendUri(logo)} alt={name || 'logo'} fill style={{ objectFit: 'contain' }} priority />
    </Box>
  ) : (
    <Avatar sx={{ width: size, height: size, bgcolor: 'primary.main', fontWeight: 700 }}>
      {name.charAt(0).toUpperCase() || <LoginOutlined />}
    </Avatar>
  );

/**
 * The shell shared by the dashboard's signed-out pages (login, forgot
 * password): a branded panel on desktop, and the page's form beside it.
 */
const AdminAuthLayout = ({ children }: { children: ReactNode }) => {
  const { t, i18n } = useTranslation();
  const { logo, siteTitle } = useAppSelector((state) => state.settings);
  const storeName = getLocalizedString(siteTitle, i18n.language);

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '5fr 6fr' },
        bgcolor: 'background.default',
      }}
    >
      {/* ── Brand panel (desktop) ── */}
      <Stack
        sx={(theme) => ({
          display: { xs: 'none', md: 'flex' },
          position: 'relative',
          overflow: 'hidden',
          p: 6,
          color: 'primary.contrastText',
          bgcolor: 'primary.main',
          backgroundImage: `
            radial-gradient(circle at 15% 20%, ${alpha(theme.palette.common.white, 0.16)} 0, transparent 45%),
            radial-gradient(circle at 85% 90%, ${alpha(theme.palette.common.black, 0.22)} 0, transparent 50%)`,
        })}
        justifyContent="space-between"
      >
        <Box
          sx={{
            alignSelf: 'flex-start',
            bgcolor: 'background.paper',
            borderRadius: 2,
            px: 2,
            py: 1.5,
            boxShadow: 3,
          }}
        >
          <StoreMark logo={logo} name={storeName} size={44} />
        </Box>

        <Stack spacing={2} maxWidth={420}>
          {storeName && (
            <Typography variant="h3" fontWeight={800} lineHeight={1.15}>
              {storeName}
            </Typography>
          )}
          <Typography variant="h6" fontWeight={400} sx={{ opacity: 0.85 }}>
            {t("adminPanelTagline")}
          </Typography>
        </Stack>

        <Typography variant="caption" sx={{ opacity: 0.7 }}>
          © {new Date().getFullYear()} {storeName} · {t("allRightsReserved")}
        </Typography>
      </Stack>

      {/* ── Page content ── */}
      <Stack sx={{ position: 'relative', px: 2, py: { xs: 4, md: 6 } }} alignItems="center" justifyContent="center">
        <Box sx={{ position: 'absolute', top: 16, insetInlineEnd: 16 }}>
          <LanguageIcon scope="dashboard" />
        </Box>

        <Stack spacing={4} sx={{ width: '100%', maxWidth: 400 }}>
          <Box sx={{ display: { xs: 'flex', md: 'none' }, justifyContent: 'center' }}>
            <StoreMark logo={logo} name={storeName} size={48} />
          </Box>
          {children}
        </Stack>
      </Stack>
    </Box>
  );
};

export default AdminAuthLayout;
