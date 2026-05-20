"use client";
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, CircularProgress, Stack } from '@mui/material';
import SectionForm from '@/features/Section/SectionForm';
import { useSectionByIdQuery } from '@/backend-api/sections/hooks';
import { changeBreadCrumbActions, resetBreadCrumbActions } from '@/Store/slices/bread-crumb';
import { useAppDispatch } from '@/Store/store';
import { use } from 'react';

interface EditSectionPageProps {
  params: Promise<{ id: string }>;
}

const EditSectionPage = ({ params }: EditSectionPageProps) => {
  const { id } = use(params);
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const { data: section, isLoading } = useSectionByIdQuery(id);

  useEffect(() => {
    dispatch(changeBreadCrumbActions({
      breadCrumb: [
        { title: t("sections"), link: `/admin/sections` },
        { title: t("editSection") },
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

  if (!section) return null;

  return (
    <Box py={3}>
      <SectionForm defaultData={section} />
    </Box>
  );
};

export default EditSectionPage;
