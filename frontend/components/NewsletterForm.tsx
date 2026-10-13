"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { Box, Button, CircularProgress, Stack, TextField, Typography } from "@mui/material";
import CheckCircleOutline from "@mui/icons-material/CheckCircleOutline";
import { subscribeToNewsletter } from "@/backend-api/subscribe/mutations";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Footer sign-up: email only. */
const NewsletterForm = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);

  const mutation = useMutation({ mutationFn: subscribeToNewsletter });

  const invalid = touched && !EMAIL.test(email.trim());

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!EMAIL.test(email.trim())) return;
    mutation.mutate(email.trim());
  };

  return (
    <Box textAlign={{ xs: "center", md: "start" }}>
      <Typography fontWeight={700} mb={0.5}>
        {t("newsletterTitle")}
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        {t("newsletterSubtitle")}
      </Typography>

      {mutation.isSuccess ? (
        <Stack direction="row" spacing={1} alignItems="center" justifyContent={{ xs: "center", md: "flex-start" }} color="success.main">
          <CheckCircleOutline fontSize="small" />
          <Typography variant="body2" fontWeight={600}>
            {t("newsletterThanks")}
          </Typography>
        </Stack>
      ) : (
        <Stack component="form" onSubmit={submit} direction={{ xs: "column", sm: "row" }} spacing={1} noValidate>
          <TextField
            size="small"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder={t("emailPlaceholder")}
            error={invalid || mutation.isError}
            helperText={
              invalid ? t("invalidEmail") : mutation.isError ? t("somethingWentWrong") : undefined
            }
            slotProps={{ htmlInput: { "aria-label": t("email"), dir: "ltr" } }}
            sx={{ flex: 1, bgcolor: "background.paper", borderRadius: 1 }}
          />
          <Button
            type="submit"
            variant="contained"
            disabled={mutation.isPending}
            sx={{ minWidth: 120, alignSelf: { sm: "flex-start" }, height: 40 }}
          >
            {mutation.isPending ? <CircularProgress size={20} color="inherit" /> : t("subscribe")}
          </Button>
        </Stack>
      )}
    </Box>
  );
};

export default NewsletterForm;
