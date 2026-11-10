"use client"

import { TextField } from "@mui/material"
import { Control, Controller, FieldValues, Path } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { cleanSlug, SLUG_PATTERN } from "@/lib/slug"

/**
 * The slug input of the product and category forms. What can be tidied is
 * ("Candy perfume" becomes candy-perfume when the field loses focus, with a
 * preview while typing); anything else (Arabic, "@", "/") is an error.
 */
export default function SlugField<T extends FieldValues>({
  name,
  control,
  hint,
}: {
  name: Path<T>
  control: Control<T>
  hint?: string
}) {
  const { t } = useTranslation()
  return (
    <Controller
      name={name}
      control={control}
      rules={{
        validate: (value: string) => !cleanSlug(value ?? "") || SLUG_PATTERN.test(cleanSlug(value)) || t("slugInvalid"),
      }}
      render={({ field, fieldState: { error } }) => {
        const value: string = field.value ?? ""
        const cleaned = cleanSlug(value)
        const tidy = SLUG_PATTERN.test(cleaned)
        const preview = value && cleaned !== value && tidy ? t("slugWillBe", { slug: cleaned }) : undefined
        return (
          <TextField
            {...field}
            value={value}
            onBlur={() => {
              if (tidy || !cleaned) field.onChange(cleaned)
              field.onBlur()
            }}
            label={t("slug")}
            size="small"
            fullWidth
            autoComplete="off"
            error={!!error}
            helperText={error?.message ?? preview ?? hint}
            slotProps={{ htmlInput: { dir: "ltr" } }}
          />
        )
      }}
    />
  )
}
