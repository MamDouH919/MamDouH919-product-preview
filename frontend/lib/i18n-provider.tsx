'use client';

import { ReactNode, useEffect } from 'react';
import '../lib/i18n';
import { useTranslation } from 'react-i18next';

export function I18nProvider({ children, language }:
  { children: ReactNode, language: string }) {
  const { i18n } = useTranslation();

  useEffect(() => {
    i18n.changeLanguage(language);
  }, [language, i18n]);

  return <>{children}</>;
}
