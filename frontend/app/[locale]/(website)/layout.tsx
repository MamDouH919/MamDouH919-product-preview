import React from 'react'
import { Box } from '@mui/material'
import Footer from '@/layouts/Home/Footer';
import Navbar from '@/layouts/Home/Header';
import SocialIcons from '@/components/SocialIcons';
import ScrollToTop from '@/components/ScrollToTop';
import GetCustomerLogged from '@/components/GetCustomerLogged';
import CartSync from '@/components/CartSync';
import ModuleRouteGate from '@/components/ModuleRouteGate';
import { Prefetched } from '@/lib/prefetch';
import { SETTINGS_QUERY_KEY } from '@/backend-api/settings/hooks';
import { CATEGORIES_QUERY_KEY } from '@/backend-api/categories/hooks';
import { PAGES_QUERY_KEY } from '@/backend-api/pages/hooks';

/** What the header and footer show on every page: its links are the site's internal linking. */
const SHELL = [
  { key: [SETTINGS_QUERY_KEY], path: '/settings' },
  { key: [CATEGORIES_QUERY_KEY], path: '/categories' },
  { key: [PAGES_QUERY_KEY, 'navigation'], path: '/pages/navigation' },
];

export default async function Layout({
  children,
}: {
  children: React.ReactNode
}) {  

  return (
    <Prefetched entries={SHELL}>
    <GetCustomerLogged>
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
      }}
    >
      <ScrollToTop />
      <CartSync />
      <Navbar />
      <SocialIcons />
      <Box component="main" sx={{ flexGrow: 1, pt: { xs: 10, md: 12 } }}>
        <ModuleRouteGate area="website">{children}</ModuleRouteGate>
      </Box>
      <Footer />
    </Box>
    </GetCustomerLogged>
    </Prefetched>
  )
}