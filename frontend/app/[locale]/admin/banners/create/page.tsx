"use client";
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Box } from '@mui/material';
import BannerForm from '@/features/Banner/BannerForm';
import { changeBreadCrumbActions, resetBreadCrumbActions } from '@/Store/slices/bread-crumb';
import { useAppDispatch } from '@/Store/store';

const CreateBannerPage = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(changeBreadCrumbActions({
      breadCrumb: [
        { title: t("banners"), link: `/admin/banners` },
        { title: t("createBanner") },
      ],
      breadCrumbBtns: [],
    }));
    return () => {
      dispatch(resetBreadCrumbActions());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box py={3}>
      <BannerForm />
    </Box>
  );
};

export default CreateBannerPage;
