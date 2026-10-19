'use client';

import { ReactNode, useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../lib/i18n';

/**
 * Pins translations to the URL's locale from the very first render. A clone
 * per provider rather than the shared instance: on the server that singleton
 * would be shared by concurrent English and Arabic requests, and on the client
 * its detected language (cookie, browser) could differ from the URL — either
 * way the server HTML and the first client render would disagree.
 */
export function I18nProvider({ children, language }:
  { children: ReactNode, language: string }) {
  const [instance] = useState(() => i18n.cloneInstance({ lng: language, initAsync: false }));

  // Later locale switches (client navigation between /en and /ar).
  useEffect(() => {
    if (instance.language !== language) instance.changeLanguage(language);
  }, [language, instance]);

  return <I18nextProvider i18n={instance}>{children}</I18nextProvider>;
}
