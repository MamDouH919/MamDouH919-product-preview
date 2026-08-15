import React from 'react'
import { Box } from '@mui/material'
import Footer from '@/layouts/Home/Footer';
import Navbar from '@/layouts/Home/Header';
import SocialIcons from '@/components/SocialIcons';
import ScrollToTop from '@/components/ScrollToTop';
import GetCustomerLogged from '@/components/GetCustomerLogged';

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {  

  return (
    <GetCustomerLogged>
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
      }}
    >
      <ScrollToTop />
      <Navbar />
      <SocialIcons />
      <Box component="main" sx={{ flexGrow: 1, pt: 9 }}>
        {children}
      </Box>
      <Footer />
    </Box>
    </GetCustomerLogged>
  )
}