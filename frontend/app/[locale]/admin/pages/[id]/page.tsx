"use client";
import { use, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CircularProgress, Stack } from '@mui/material';
import PageBuilder from '@/features/Page/PageBuilder';
import { usePageByIdQuery } from '@/backend-api/pages/hooks';
import { changeBreadCrumbActions, resetBreadCrumbActions } from '@/Store/slices/bread-crumb';
import { useAppDispatch } from '@/Store/store';

interface EditPagePageProps {
  params: Promise<{ id: string }>;
}

const EditPagePage = ({ params }: EditPagePageProps) => {
  const { id } = use(params);
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const { data: page, isLoading } = usePageByIdQuery(id);

  useEffect(() => {
    dispatch(changeBreadCrumbActions({
      breadCrumb: [
        { title: t("pages"), link: `/admin/pages` },
        { title: t("editPage") },
      ],
      breadCrumbBtns: [],
    }));
    return () => {
      dispatch(resetBreadCrumbActions());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading || !page) {
    return (
      <Stack alignItems="center" justifyContent="center" height="60vh">
        <CircularProgress />
      </Stack>
    );
  }

  // Keyed by id so creating a page and landing here starts from the saved copy.
  return <PageBuilder key={page._id} defaultData={page} />;
};

export default EditPagePage;
