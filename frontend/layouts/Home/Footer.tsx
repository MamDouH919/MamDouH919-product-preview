'use client';

import {
  Box,
  Container,
  Divider,
  Grid,
  Link as MuiLink,
  Stack,
  Typography,
} from '@mui/material';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';
// import EmailOutlined from '@mui/icons-material/EmailOutlined';
// import PhoneOutlined from '@mui/icons-material/PhoneOutlined';
import LocationOnOutlined from '@mui/icons-material/LocationOnOutlined';
// import WhatsAppIcon from '@mui/icons-material/WhatsApp';
// import FacebookIcon from '@mui/icons-material/Facebook';
// import InstagramIcon from '@mui/icons-material/Instagram';
// import TwitterIcon from '@mui/icons-material/Twitter';
// import LinkedInIcon from '@mui/icons-material/LinkedIn';
// import YouTubeIcon from '@mui/icons-material/YouTube';
import { useAppSelector } from '@/Store/store';
import { getBackendUri } from '@/utils/helperFunctions';
import { useSettingsQuery } from '@/backend-api/settings/hooks';
import SocialMediaLinks from '@/components/Social';

// const SOCIAL_ICONS: Record<string, React.ElementType> = {
//   FACEBOOK: FacebookIcon,
//   INSTAGRAM: InstagramIcon,
//   TWITTER: TwitterIcon,
//   LINKEDIN: LinkedInIcon,
//   YOUTUBE: YouTubeIcon,
//   WHATSAPP: WhatsAppIcon,
// };

const linkStyle = {
  color: 'text.secondary',
  textDecoration: 'none',
  fontSize: '0.875rem',
  transition: 'color 0.2s ease',
  display: 'block',
  '&:hover': { color: 'primary.main' },
};

const Footer = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const { logo } = useAppSelector((state) => state.settings);
  const { data: settings } = useSettingsQuery();

  const socialLinks = (settings?.socialMedia ?? []).filter((s) => s.value);

  return (
    <Box
      component="footer"
      sx={{
        backgroundColor: (th) => th.palette.background.default,
        color: (th) => th.palette.text.primary,
        mt: 'auto',
      }}
      borderTop={"1px solid #e7e7e7"}
    >
      {/* Top bar */}
      {/* <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', py: 1.2 }}>
        <Container maxWidth="lg">
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Stack direction="row" alignItems="center" spacing={3} flexWrap="wrap">
              {settings?.phone && (
                <MuiLink
                  href={`tel:${settings.phone}`}
                  sx={{
                    color: 'text.secondary',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.8,
                    fontSize: '0.85rem',
                    '&:hover': { color: 'primary.main' },
                  }}
                >
                  <PhoneOutlined sx={{ fontSize: 15 }} />
                  {settings.phone}
                </MuiLink>
              )}
              {settings?.email && (
                <MuiLink
                  href={`mailto:${settings.email}`}
                  sx={{
                    color: 'text.secondary',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.8,
                    fontSize: '0.85rem',
                    '&:hover': { color: 'primary.main' },
                  }}
                >
                  <EmailOutlined sx={{ fontSize: 15 }} />
                  {settings.email}
                </MuiLink>
              )}
            </Stack>

            {socialLinks.length > 0 && (
              <Stack direction="row" spacing={1.5} alignItems="center">
                {socialLinks.map((s) => {
                  const Icon = SOCIAL_ICONS[s.key];
                  if (!Icon) return null;
                  return (
                    <MuiLink
                      key={s.key}
                      href={s.value}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{
                        color: 'text.secondary',
                        display: 'flex',
                        alignItems: 'center',
                        transition: 'color 0.2s ease',
                        '&:hover': { color: 'primary.main' },
                      }}
                    >
                      <Icon sx={{ fontSize: 18 }} />
                    </MuiLink>
                  );
                })}
              </Stack>
            )}
          </Stack>
        </Container>
      </Box> */}

      {/* Main footer body */}
      <Box sx={{ pt: 1, pb: 1 }}>
        <Container maxWidth="lg">
          {socialLinks.length > 0 && (
            <Stack direction="row" alignItems="center" justifyContent="center" mb={1}>
              <Stack direction="row" spacing={1.5} flexWrap="wrap">
                <SocialMediaLinks links={socialLinks.map((s) => ({ code: s.key, link: s.value }))} />
              </Stack>
            </Stack>
          )}

          {/* Bottom bar */}
          <Divider sx={{ mt: 1, mb: 1 }} />
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }} textAlign={"center"}>
            © {new Date().getFullYear()} - <a href="https://mamdouh.mountain-egy.site/" target="_blank" rel="noopener noreferrer">
              Mamdouh Mohamed
            </a> — {t('allRightsReserved')}
          </Typography>
        </Container>
      </Box>
    </Box>
  );
};

export default Footer;
