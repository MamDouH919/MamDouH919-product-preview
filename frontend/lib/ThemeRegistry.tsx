'use client';

import { ThemeProvider, CssBaseline } from '@mui/material';

import { useMemo } from 'react';
import getTheme from './theme';
import config from '@/config.json';
import { Toaster } from 'sonner';

import { cairo } from "./fonts";
import { useAppSelector } from '@/Store/store';

export default function ThemeRegistry({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale: string;
}) {
  const isRtl = config.app.rtlLanguages.includes(locale);

  const primaryColor = useAppSelector((state) => state.settings.primaryColor);

  const theme = useMemo(() => getTheme({
    primary: primaryColor ?? "#654321",
    secondary: "#654321",
    dir: isRtl ? "rtl" : "ltr"
  }), [isRtl, primaryColor]);

  return (
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
  );
}
