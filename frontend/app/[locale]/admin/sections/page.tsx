"use client";
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSectionsQuery } from '@/backend-api/sections/hooks';
import { Section } from '@/backend-api/sections/types';
import Image from 'next/image';
import { getBackendUri } from '@/utils/helperFunctions';
import { IconButton, Stack } from '@mui/material';
import Edit from '@mui/icons-material/Edit';
import CustomLink from '@/components/CustomLink';
import { changeBreadCrumbActions, resetBreadCrumbActions } from '@/Store/slices/bread-crumb';
import { useAppDispatch, useAppSelector } from '@/Store/store';
import SimpleTable from '@/components/Table/SimpleTable';

const getNestedValue = (obj: any, path: string) => {
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
};

const SectionsList = () => {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const isSuper = useAppSelector((state) => state.auth.isSuper);
  const lang = i18n.language;

  const { data: sections, isLoading } = useSectionsQuery();

  const sectionsData = useMemo(
    () => sections?.map((section: Section) => ({ ...section, id: section._id })) ?? [],
    [sections]
  );

  useEffect(() => {
    dispatch(changeBreadCrumbActions({
      breadCrumb: [
        { title: t("sections") },
      ],
      breadCrumbBtns: isSuper ? [
        {
          title: t("createSection"),
          icon: "add",
          link: `/${i18n.language}/admin/sections/create`,
        },
      ] : [],
    }));
    return () => {
      dispatch(resetBreadCrumbActions());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const columns = useMemo(() => [
    {
      id: "image",
      header: t("image"),
      render: (row: any) => {
        const imageUrl = getBackendUri(getNestedValue(row, 'image'));
        if (!imageUrl) return null;
        return (
          <Stack p={0.5}>
            <Image
              src={imageUrl}
              alt={row.sectionName || ''}
              width={80}
              height={45}
              style={{ width: 80, height: 45, objectFit: 'cover', borderRadius: 4 }}
              loading="eager"
            />
          </Stack>
        );
      },
    },
    {
      id: "sectionName",
      header: t("sectionName"),
      render: (row: any) => row.sectionName || '',
    },
    {
      id: "title",
      header: t("title"),
      render: (row: any) => getNestedValue(row, `title.${lang}`) || getNestedValue(row, 'title.en') || '',
    },
    {
      id: "actions",
      header: t("actions"),
      render: (row: any) => (
        <Stack direction="row">
          <CustomLink href={`/admin/sections/${row._id}`}>
            <IconButton>
              <Edit />
            </IconButton>
          </CustomLink>
        </Stack>
      ),
    },
  ], [t, lang]);

  return (
    <SimpleTable
      columns={columns}
      data={sectionsData}
      borderRadius={0}
      height='100%'
      loading={isLoading}
    />
  );
};

export default SectionsList;
