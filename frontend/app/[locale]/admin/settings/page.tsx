"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Box, Button, CircularProgress, Stack, Tab, Tabs } from "@mui/material";
import { useSettingsQuery, SETTINGS_QUERY_KEY } from "@/backend-api/settings/hooks";
import { updateSettings } from "@/backend-api/settings/mutations";
import { getBackendUri } from "@/utils/helperFunctions";
import { useAppDispatch, useAppSelector } from "@/Store/store";
import { changeBreadCrumbActions, resetBreadCrumbActions } from "@/Store/slices/bread-crumb";
import { setSettings } from "@/Store/slices/settings";
import { PRICE_LIST_QUERY_KEY, ZONES_QUERY_KEY } from "@/backend-api/price-list/hooks";
import { useStoreLocales } from "@/lib/storeLocalesContext";
import RefundRulesCard from "@/features/Refund/RefundRulesCard";
import { useStoreModules } from "@/Hooks/useStoreModules";
import { normalizeSocialKey } from "@/lib/social";
import { ALL_LANGS, type SettingsFormValues } from "@/features/Settings/types";
import SiteInfoSection from "@/features/Settings/SiteInfoSection";
import SiteImagesSection from "@/features/Settings/SiteImagesSection";
import DeliveryCountrySection from "@/features/Settings/DeliveryCountrySection";
import ReturnsSection from "@/features/Settings/ReturnsSection";
import PreordersSection from "@/features/Settings/PreordersSection";
import AppearanceSection from "@/features/Settings/AppearanceSection";
import StorefrontSection from "@/features/Settings/StorefrontSection";
import CostPercentagesSection from "@/features/Settings/CostPercentagesSection";
import ContentLanguagesSection from "@/features/Settings/ContentLanguagesSection";
import ContactInfoSection from "@/features/Settings/ContactInfoSection";
import SocialMediaSection from "@/features/Settings/SocialMediaSection";

const SettingsPage = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const dispatch = useAppDispatch();
  const isSuper = useAppSelector((s) => s.auth.isSuper);
  const { multilingual } = useStoreLocales();
  const { data: settings, isLoading } = useSettingsQuery();
  // Delivery, returns and refunds only mean something to a store that takes orders.
  const { has } = useStoreModules();
  const sells = has("orders");
  const [tab, setTab] = useState("general");

  const { control, handleSubmit, reset, register } = useForm<SettingsFormValues>({
    defaultValues: {
      siteTitle: Object.fromEntries(ALL_LANGS.map((l) => [l, ""])),
      siteDescription: Object.fromEntries(ALL_LANGS.map((l) => [l, ""])),
      currency: Object.fromEntries(ALL_LANGS.map((l) => [l, ""])),
      logo: null,
      favicon: null,
      phone: "",
      whatsapp: "",
      landLine: "",
      email: "",
      address: "",
      socialMedia: [],
      primaryColor: "#1976d2",
      country: "",
      returnWindowDays: "14",
      showPrices: true,
      preorderEnabled: false,
      contentLanguages: "both",
      costPlus5Percent: false,
      costPlus15Percent: false,
    },
  });


  useEffect(() => {
    dispatch(changeBreadCrumbActions({ breadCrumb: [{ title: t("settings") }] }));
    return () => { dispatch(resetBreadCrumbActions()); };
  }, [dispatch, t]);


  useEffect(() => {
    if (settings) {
      reset({
        siteTitle: Object.fromEntries(
          ALL_LANGS.map((l) => [l, (settings.siteTitle as any)?.[l] || ""])
        ),
        siteDescription: Object.fromEntries(
          ALL_LANGS.map((l) => [l, (settings.siteDescription as any)?.[l] || ""])
        ),
        currency: Object.fromEntries(
          ALL_LANGS.map((l) => [l, (settings.currency as any)?.[l] || ""])
        ),
        logo: settings.logo ? getBackendUri(settings.logo) : null,
        favicon: settings.favicon ? getBackendUri(settings.favicon) : null,
        phone: settings.phone ?? "",
        whatsapp: settings.whatsapp ?? "",
        landLine: settings.landLine ?? "",
        email: settings.email ?? "",
        address: settings.address ?? "",
        // Old keys ("TWITTER") under their current name, so the select shows them.
        socialMedia: (settings.socialMedia ?? []).map((s) => ({ ...s, key: normalizeSocialKey(s.key) })),
        primaryColor: settings.primaryColor ?? "#1976d2",
        country: settings.country ?? "",
        returnWindowDays: String(settings.returnWindowDays ?? 14),
        showPrices: settings.showPrices ?? true,
        preorderEnabled: settings.preorderEnabled ?? false,
        contentLanguages: settings.contentLanguages ?? "both",
        costPlus5Percent: settings.costPlus5Percent ?? false,
        costPlus15Percent: settings.costPlus15Percent ?? false,
      });
    }
  }, [settings, reset]);

  const { mutate, isPending } = useMutation({
    mutationFn: (data: SettingsFormValues) => {
      const formData = new FormData();
      ALL_LANGS.forEach((lang) => {
        const title = (data.siteTitle as any)?.[lang];
        const desc = (data.siteDescription as any)?.[lang];
        const cur = (data.currency as any)?.[lang];
        if (title) formData.append(`siteTitle[${lang}]`, title);
        if (desc) formData.append(`siteDescription[${lang}]`, desc);
        if (cur) formData.append(`currency[${lang}]`, cur);
      });
      if (data.logo instanceof File) formData.append("logo", data.logo);
      if (data.favicon instanceof File) formData.append("favicon", data.favicon);
      if (data.phone) formData.append("phone", data.phone);
      if (data.whatsapp) formData.append("whatsapp", data.whatsapp);
      if (data.landLine) formData.append("landLine", data.landLine);
      if (data.email) formData.append("email", data.email);
      if (data.address) formData.append("address", data.address);
      if (data.primaryColor) formData.append("primaryColor", data.primaryColor);
      // Only a super admin may set it; the server seeds the country's zones.
      if (isSuper && sells && data.country) formData.append("country", data.country);
      if (sells && data.returnWindowDays !== "") formData.append("returnWindowDays", data.returnWindowDays);
      if (!sells) formData.append("showPrices", String(data.showPrices));
      if (sells && has("inventory")) formData.append("preorderEnabled", String(data.preorderEnabled));
      // Only a store published in more than one language has a choice to make.
      if (multilingual) formData.append("contentLanguages", data.contentLanguages);
      if (isSuper) {
        formData.append("costPlus5Percent", String(data.costPlus5Percent));
        formData.append("costPlus15Percent", String(data.costPlus15Percent));
      }
      (data.socialMedia ?? []).forEach((item, i) => {
        formData.append(`socialMedia[${i}][key]`, item.key);
        formData.append(`socialMedia[${i}][value]`, item.value);
      });
      return updateSettings(formData);
    },
    onSuccess: (_, variables) => {
      toast.success(t("saveSuccessfully"));
      queryClient.invalidateQueries({ queryKey: [SETTINGS_QUERY_KEY] });
      dispatch(setSettings({ showPrices: variables.showPrices }));
      queryClient.invalidateQueries({ queryKey: [ZONES_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [PRICE_LIST_QUERY_KEY] });
    },
    onError: () => {
      toast.error(t("somethingWentWrong"));
    },
  });

  if (isLoading) {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 300 }}>
        <CircularProgress />
      </Stack>
    );
  }


  const hasRefunds = isSuper && sells && has("finance");

  // Groups with nothing to show for this admin are left out.
  const groups: { key: string; label: string; content: ReactNode[] }[] = [
    {
      key: "general",
      label: t("general"),
      content: [
        isSuper && <SiteInfoSection key="info" control={control} />,
        isSuper && <SiteImagesSection key="images" control={control} logo={settings?.logo} favicon={settings?.favicon} />,
        isSuper && <AppearanceSection key="appearance" control={control} />,
        multilingual && <ContentLanguagesSection key="langs" control={control} />,
      ].filter(Boolean),
    },
    {
      key: "store",
      label: t("storefront"),
      content: [
        isSuper && sells && <DeliveryCountrySection key="country" control={control} />,
        isSuper && sells && <ReturnsSection key="returns" control={control} />,
        isSuper && sells && has("inventory") && <PreordersSection key="preorders" control={control} />,
        !sells && <StorefrontSection key="storefront" control={control} />,
        isSuper && <CostPercentagesSection key="cost" control={control} />,
      ].filter(Boolean),
    },
    {
      key: "contact",
      label: t("contactInfo"),
      // Contact and social links are visible to all admins.
      content: [
        <ContactInfoSection key="contact" control={control} register={register} />,
        <SocialMediaSection key="social" control={control} register={register} />,
      ],
    },
  ].filter((g) => g.content.length > 0 || (g.key === "store" && hasRefunds));

  const current = groups.some((g) => g.key === tab) ? tab : groups[0].key;

  return (
    <Stack spacing={3}>
      <Tabs
        value={current}
        onChange={(_, v) => setTab(v)}
        variant="scrollable"
        allowScrollButtonsMobile
        sx={{ borderBottom: 1, borderColor: "divider" }}
      >
        {groups.map((g) => (
          <Tab key={g.key} value={g.key} label={g.label} />
        ))}
      </Tabs>

      {/* All groups stay mounted so one Save covers every tab. */}
      <Box component="form" onSubmit={handleSubmit((d) => mutate(d))}>
        <Stack spacing={3}>
          {groups.map((g) => (
            <Stack key={g.key} spacing={3} sx={{ display: current === g.key ? "flex" : "none" }}>
              {g.content}
            </Stack>
          ))}

          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={isPending}
            startIcon={isPending ? <CircularProgress size={18} /> : null}
            sx={{ alignSelf: "flex-start" }}
          >
            {t("save")}
          </Button>
        </Stack>
      </Box>

      {/* Its own card and save: refund rules are finance settings, not part of this form. */}
      {hasRefunds && current === "store" && <RefundRulesCard />}
    </Stack>
  );
};

export default SettingsPage;
