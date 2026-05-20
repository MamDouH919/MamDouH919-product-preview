'use client';

import { CacheProvider } from '@emotion/react';
import { ThemeProvider, CssBaseline } from '@mui/material';

import { useMemo } from 'react';
import getTheme from './theme';
import createEmotionCache from './createEmotionCache';
import config from '@/config.json';
import { Toaster } from 'sonner';

import { Cairo } from "next/font/google";
import { useAppSelector } from '@/Store/store';

// Import Cairo font from Google Fonts via Next.js
const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

export default function ThemeRegistry({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale: string;
}) {
  const isRtl = config.app.rtlLanguages.includes(locale);
  const cache = useMemo(() => createEmotionCache(isRtl), [isRtl]);

  const primaryColor = useAppSelector((state) => state.settings.primaryColor);

  console.log(primaryColor);



  const theme = useMemo(() => getTheme({
    primary: primaryColor ?? "#654321",
    secondary: "#654321",
    dir: isRtl ? "rtl" : "ltr"
  }), [isRtl, primaryColor]);

  return (
    <CacheProvider value={cache}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Toaster
          richColors
          position={"top-center"}
          style={{
            fontFamily: cairo.style.fontFamily,
          }}
          toastOptions={{
            // className: "toast-style",
            style: {
              fontFamily: cairo.style.fontFamily,
            },
          }}
        />
        {children}
      </ThemeProvider>
    </CacheProvider>
  );
}
