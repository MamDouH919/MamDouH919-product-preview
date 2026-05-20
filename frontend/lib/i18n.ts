import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import config from '@/config.json';

import en from '../locales/en';
import ar from '../locales/ar';

const locales: Record<string, any> = { en, ar };

const resources = Object.fromEntries(
    config.app.languages.map((lang) => [lang, { translation: locales[lang] || {} }])
);

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources,
        fallbackLng: config.app.defaultLanguage,
        supportedLngs: config.app.languages,
        detection: {
            order: ['cookie', 'localStorage', 'navigator'],
            caches: ['localStorage', 'cookie'],
        },
        interpolation: {
            escapeValue: false,
        },
    });

export default i18n;
