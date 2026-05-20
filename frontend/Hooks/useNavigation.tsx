import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';

export const useNavigation = () => {
  const router = useRouter();
  const { i18n } = useTranslation();

  const navigate = (url: string) => {
    const lang = i18n.language;
    const path = url.startsWith('/') ? `/${lang}${url}` : `/${lang}/${url}`;
    router.push(path);
  };

  return { navigate };
};
