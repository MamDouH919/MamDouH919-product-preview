"use client";
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, CircularProgress, Stack } from '@mui/material';
import BannerForm from '@/features/Banner/BannerForm';
import { useBannerByIdQuery } from '@/backend-api/banners/hooks';
import { changeBreadCrumbActions, resetBreadCrumbActions } from '@/Store/slices/bread-crumb';
import { useAppDispatch } from '@/Store/store';
import { use } from 'react';

interface EditBannerPageProps {
  params: Promise<{ id: string }>;
}

const EditBannerPage = ({ params }: EditBannerPageProps) => {
  const { id } = use(params);
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const { data: banner, isLoading } = useBannerByIdQuery(id);

  useEffect(() => {
    dispatch(changeBreadCrumbActions({
      breadCrumb: [
        { title: t("banners"), link: `/admin/banners` },
        { title: t("editBanner") },
      ],
      breadCrumbBtns: [],
    }));
    return () => {
      dispatch(resetBreadCrumbActions());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) {
    return (
      <Stack alignItems="center" justifyContent="center" height="60vh">
        <CircularProgress />
      </Stack>
    );
  }

  return (
    <Box py={3}>
      <BannerForm defaultData={banner} />
    </Box>
  );
};

export default EditBannerPage;
