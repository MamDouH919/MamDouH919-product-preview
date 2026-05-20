"use client";
import { useCallback, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next';
import DragAndDropTable from '@/components/Table/DragAndDropTable';
import { useBannersQuery } from '@/backend-api/banners/hooks';
import { deleteBanner, toggleBannerActive, updateBannerWeight } from '@/backend-api/banners/mutations';
import { Banner } from '@/backend-api/banners/types';
import Image from 'next/image';
import { getBackendUri } from '@/utils/helperFunctions';
import { IconButton, Stack, Switch } from '@mui/material';
import Delete from '@mui/icons-material/Delete';
import Edit from '@mui/icons-material/Edit';
import CustomLink from '@/components/CustomLink';
import { changeBreadCrumbActions, resetBreadCrumbActions } from '@/Store/slices/bread-crumb';
import { useAppDispatch } from '@/Store/store';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BANNERS_QUERY_KEY } from '@/backend-api/banners/hooks';
import { toast } from 'sonner';

const getNestedValue = (obj: any, path: string) => {
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
};

const BannersList = () => {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const lang = i18n.language;

  const { data: banners, isLoading } = useBannersQuery();

  const bannersData = useMemo(
    () => banners?.map((banner: Banner) => ({ ...banner, id: banner._id })) ?? [],
    [banners]
  );

  const toggleActiveMutation = useMutation({
    mutationFn: toggleBannerActive,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BANNERS_QUERY_KEY] });
    },
    onError: () => {
      toast.error(t("somethingWentWrong"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteBanner,
    onSuccess: () => {
      toast.success(t("saveSuccessfully"));
      queryClient.invalidateQueries({ queryKey: [BANNERS_QUERY_KEY] });
    },
    onError: () => {
      toast.error(t("somethingWentWrong"));
    },
  });

  const handleReorder = useCallback(
    async (reordered: any[], draggedId: string) => {
      const draggedItem = reordered.find((item) => item.id === draggedId);
      if (draggedItem) {
        const newIndex = reordered.indexOf(draggedItem);
        await updateBannerWeight({ id: draggedItem._id, weight: newIndex + 1 });
      }
    },
    []
  );

  useEffect(() => {
    dispatch(changeBreadCrumbActions({
      breadCrumb: [
        { title: t("banners") },
      ],
      breadCrumbBtns: [
        {
          title: t("createBanner"),
          icon: "add",
          link: `/${i18n.language}/admin/banners/create`,
        },
      ],
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
              alt={getNestedValue(row, `title.${lang}`) || ''}
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
      id: "title",
      header: t("title"),
      render: (row: any) => getNestedValue(row, `title.${lang}`) || getNestedValue(row, 'title.en') || '',
    },
    {
      id: "active",
      header: t("active"),
      render: (row: any) => (
        <Switch
          checked={!!row.active}
          onChange={(e) => toggleActiveMutation.mutate({ id: row._id, active: e.target.checked })}
          disabled={toggleActiveMutation.isPending}
          size="small"
        />
      ),
    },
    {
      id: "actions",
      header: t("actions"),
      render: (row: any) => (
        <Stack direction="row">
          <CustomLink href={`/admin/banners/${row._id}`}>
            <IconButton>
              <Edit />
            </IconButton>
          </CustomLink>
          <IconButton
            color="error"
            onClick={() => deleteMutation.mutate(row._id)}
            disabled={deleteMutation.isPending}
          >
            <Delete />
          </IconButton>
        </Stack>
      ),
    },
  ], [t, lang, deleteMutation, toggleActiveMutation]);

  return (
    <DragAndDropTable
      columns={columns}
      data={bannersData}
      borderRadius={0}
      onReorder={handleReorder}
      height='100%'
      loading={isLoading}
    />
  );
};

export default BannersList;
