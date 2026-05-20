"use client";

import { Upload } from "@mui/icons-material";
import {
  CircularProgress,
  IconButton,
  InputAdornment,
  TextField,
  TextFieldProps,
} from "@mui/material";
import { KeyboardEvent, useRef } from "react";
import { Control, Controller, FieldValues, Path } from "react-hook-form";
import { useTranslation } from "react-i18next";
export const capitalizeFirstLetter = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);
interface IProps<T extends FieldValues>
  extends Omit<TextFieldProps, "variant"> {
  name: Path<T>;
  label: string;
  variant?: "outlined" | "filled" | "standard";
  control: Control<T>;
  rules?: any;
  loading?: boolean;
  onChangeFn?: (e: any) => void;
  multiEntry?: boolean;
  setValue?: (name: Path<T>, value: any, options?: any) => void;
  required?: boolean;
  fileUpload?: boolean;
  accept?: string;
  fileInputKey?: string | number;
  inputRef?: React.RefObject<HTMLInputElement>; // 👈 Add this prop
  readOnly?: boolean;
}

const TextInputComponent = <T extends FieldValues>({
  name,
  label,
  control,
  variant,
  required = false,
  rules,
  loading,
  onChangeFn,
  multiEntry,
  setValue,
  fileUpload = false,
  accept,
  fileInputKey,
  inputRef, // 👈 Accept inputRef prop
  readOnly = false,
  ...rest
}: IProps<T>) => {
  const { t } = useTranslation();
  const fileDialogOpenRef = useRef(false);



  const processMultiEntry = (value: string) => {
    const trimmed = value.trim();
    const endsWithComma = trimmed.endsWith(",");
    const cleaned = trimmed
      .split(",")
      .map((i) => i.trim())
      .filter((i) => i !== "")
      .join(",");
    return endsWithComma ? cleaned + "," : cleaned;
  };

  const handleEnter = (
    e: KeyboardEvent<HTMLDivElement>,
    value: string,
    onChange: (val: string) => void
  ) => {
    if (e.key === "Enter") {
      const trimmed = value.trim();
      const endsWithComma = trimmed.endsWith(",");

      if (multiEntry && trimmed !== "" && !endsWithComma) {
        const newValue = `${trimmed},`;
        onChange(newValue);
        setValue?.(name, newValue);
      }
    }
  };

  const handleFileClick = (inputRef: HTMLInputElement | null) => {
    if (inputRef && !fileDialogOpenRef.current) {
      inputRef.value = "";
      fileDialogOpenRef.current = true;
      inputRef.click();

      setTimeout(() => {
        fileDialogOpenRef.current = false;
      }, 100);
    }
  };

  // const handleFocus = (inputRef: HTMLInputElement | null) => {
  //   if (fileUpload && inputRef && !fileDialogOpenRef.current) {
  //     handleFileClick(inputRef);
  //   }
  // };

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: any
  ) => {
    fileDialogOpenRef.current = false;
    const target = e.target;
    const files = target.files;
    field.onChange(files);
    setValue?.(name, files);
    onChangeFn?.(e);
  };

  if (loading) return <InputSkeletonWithSpinner />;

  return (
    <Controller
      name={name}
      control={control}
      rules={
        required ? {
          required: t("fieldIsRequired"),
          validate: {
            whiteSpace: (value) => {
              if (value && typeof value === "string") {
                return !!value.trim() || t("fieldIsRequired");
              }
            },
          }
        } : {
          validate: {
            whiteSpace: (value) => {
              if (value && typeof value === "string") {
                return !!value.trim() || t("fieldIsRequired");
              }
            },
          },
          ...rules
        }
      }
      render={({ field, fieldState: { error } }) => (
        <>
          {fileUpload && (
            <input
              key={fileInputKey}
              ref={(ref) => {
                if (ref) {
                  (field as any).inputRef = ref;
                }
              }}
              type="file"
              accept={accept}
              style={{ display: "none" }}
              onChange={(e) => {
                handleFileChange(e, field);
              }}
            />
          )}
          <TextField
            {...field}
            autoComplete="off"
            value={
              fileUpload ? field.value?.[0]?.name || "" : field.value ?? ""
            }
            label={
              rules?.required || required
                ? `${capitalizeFirstLetter(t(label))} *`
                : capitalizeFirstLetter(t(label))
            }
            error={!!error}
            helperText={error?.message}
            size="small"
            fullWidth
            variant={variant || "outlined"}
            type={fileUpload ? "text" : rest.type}
            inputRef={inputRef} //
            InputProps={{
              readOnly: fileUpload || readOnly,
              style: fileUpload ? { cursor: "pointer" } : undefined,
              endAdornment: fileUpload ? (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => handleFileClick((field as any).inputRef)}
                    edge="end"
                    size="small"
                    disabled={rest.disabled}
                  >
                    <Upload />
                  </IconButton>
                </InputAdornment>
              ) : (
                rest.InputProps?.endAdornment
              ),
              ...rest.InputProps,
            }}
            onChange={
              fileUpload
                ? undefined
                : (e) => {
                  const inputVal = e.target.value?.toString()?.trimStart();
                  const processedVal = multiEntry
                    ? processMultiEntry(inputVal)
                    : inputVal;

                  field.onChange(processedVal);
                  setValue?.(name, processedVal);
                  onChangeFn?.(e);
                }
            }
            onPaste={
              fileUpload
                ? undefined
                : (e) => {
                  if (!multiEntry) return;
                  e.preventDefault();
                  const pasted = e.clipboardData
                    .getData("text")
                    .replace(/\n/g, ",");
                  const inputValue = (field.value ?? "") + pasted;
                  const processed = processMultiEntry(inputValue);
                  field.onChange(processed);
                  setValue?.(name, processed);
                }
            }
            onKeyDown={
              fileUpload
                ? undefined
                : (e) => handleEnter(e, field.value ?? "", field.onChange)
            }
            // onFocus={
            //   fileUpload
            //     ? () => handleFocus((field as any).inputRef)
            //     : undefined
            // }
            // onClick={
            //   fileUpload
            //     ? () => handleFileClick((field as any).inputRef)
            //     : undefined
            // }
            {...rest}
          />
        </>
      )}
    />
  );
};

export default TextInputComponent;

export const InputSkeletonWithSpinner = () => {
  return (
    <TextField
      fullWidth
      disabled
      label="Loading"
      variant="filled"
      slotProps={{
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <CircularProgress size={20} />
            </InputAdornment>
          ),
        },
      }}
    />
  );
};
