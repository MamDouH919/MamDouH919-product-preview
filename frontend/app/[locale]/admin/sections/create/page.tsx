"use client";
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Box } from '@mui/material';
import SectionForm from '@/features/Section/SectionForm';
import { changeBreadCrumbActions, resetBreadCrumbActions } from '@/Store/slices/bread-crumb';
import { useAppDispatch } from '@/Store/store';

const CreateSectionPage = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(changeBreadCrumbActions({
      breadCrumb: [
        { title: t("sections"), link: `/admin/sections` },
        { title: t("createSection") },
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
      <SectionForm />
    </Box>
  );
};

export default CreateSectionPage;
