"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { useTranslation } from "react-i18next"
import { useMutation } from "@tanstack/react-query"
import { Alert, Button, Container, Paper, Stack, Typography } from "@mui/material"
import NotificationsOffOutlined from "@mui/icons-material/NotificationsOffOutlined"
import { optOutOfCartReminders } from "@/backend-api/cart/queries"
import CustomLink from "@/components/CustomLink"

/**
 * Opened from a cart reminder. It asks for a click rather than acting on load:
 * mail scanners open links in emails, and would otherwise opt people out.
 */
function OptOut() {
  const { t } = useTranslation()
  const token = useSearchParams().get("token")
  const mutation = useMutation({ mutationFn: () => optOutOfCartReminders(token!) })

  return (
    <Paper variant="outlined" sx={{ p: { xs: 3, md: 4 }, borderRadius: 3 }}>
      <Stack spacing={2.5} alignItems="flex-start">
        <Stack direction="row" spacing={1.5} alignItems="center">
          <NotificationsOffOutlined color="primary" />
          <Typography variant="h6" fontWeight={700}>
            {t("cartRemindersTitle")}
          </Typography>
        </Stack>

        {!token ? (
          <Alert severity="error" sx={{ width: "100%" }}>{t("invalidLink")}</Alert>
        ) : mutation.isSuccess ? (
          <>
            <Alert severity="success" sx={{ width: "100%" }}>{t("cartRemindersStopped")}</Alert>
            <CustomLink href="/products">
              <Button>{t("continueShopping")}</Button>
            </CustomLink>
          </>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary">
              {t("cartRemindersOptOutBody")}
            </Typography>
            {mutation.isError && (
              <Alert severity="error" sx={{ width: "100%" }}>
                {(mutation.error as any)?.response?.status === 400
                  ? t("invalidLink")
                  : t("somethingWentWrong")}
              </Alert>
            )}
            <Button variant="contained" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
              {t("stopCartReminders")}
            </Button>
          </>
        )}
      </Stack>
    </Paper>
  )
}

export default function CartRemindersOptOutClient() {
  return (
    <Container maxWidth="sm" sx={{ py: { xs: 4, md: 8 } }}>
      <Suspense>
        <OptOut />
      </Suspense>
    </Container>
  )
}
