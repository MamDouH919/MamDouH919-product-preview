"use client";
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import PageBuilder from '@/features/Page/PageBuilder';
import { changeBreadCrumbActions, resetBreadCrumbActions } from '@/Store/slices/bread-crumb';
import { useAppDispatch } from '@/Store/store';

const CreatePagePage = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(changeBreadCrumbActions({
      breadCrumb: [
        { title: t("pages"), link: `/admin/pages` },
        { title: t("createPage") },
      ],
      breadCrumbBtns: [],
    }));
    return () => {
      dispatch(resetBreadCrumbActions());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <PageBuilder />;
};

export default CreatePagePage;
