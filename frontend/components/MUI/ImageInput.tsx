"use client";

import { CloudUpload, Delete } from "@mui/icons-material";
import { Box, IconButton, Stack, Typography } from "@mui/material";
import * as React from "react";
import Dropzone, { FileRejection } from "react-dropzone";
import { useController, Control, RegisterOptions } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

interface ImageInputProps {
  name: string;
  control: Control<any>;
  rules?: RegisterOptions;
  progress?: number;
  accept?: Record<string, string[]>;
  maxSize?: number;
  disabled?: boolean;
  loading?: boolean;
  variant?: "drag" | "input"; // new prop
  size?: string;
  width?: string;
  height?: string;
  imagePath?: string;
}

export function ImageInput({
  name,
  control,
  rules,
  progress,
  accept = { "image/*": [] },
  // maxSize = 1024 * 1024 * 5,
  maxSize,
  disabled = false,
  loading = false,
  variant = "drag", // default is drag
  width,
  height,
  imagePath,
}: ImageInputProps) {
  const {
    field: { value, onChange },
    fieldState: { error },
  } = useController({
    name,
    control,
    rules,
  });

  const [preview, setPreview] = React.useState<string | null>(null);
  const [imageCleared, setImageCleared] = React.useState(false);
  const [hovered, setHovered] = React.useState(false);
  const { t } = useTranslation();

  const handleDrop = React.useCallback(
    (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
      const image = acceptedFiles[0];
      if (!image) return;

      const previewURL = URL.createObjectURL(image);
      setPreview(previewURL);
      onChange(image);

      rejectedFiles.forEach(({ file, errors }) => {
        errors.forEach((err) => {
          toast.error(`Error: ${file.name} - ${err.message}`);
        });
      });
    },
    [onChange]
  );

  React.useEffect(() => {
    if (value instanceof File) {
      const previewURL = URL.createObjectURL(value);
      setPreview(previewURL);
      return () => URL.revokeObjectURL(previewURL);
    } else if (typeof value === "string") {
      setPreview(imagePath || value);
    } else if (imagePath && !imageCleared) {
      setPreview(imagePath);
    } else {
      setPreview(null);
    }
  }, [value, imagePath, imageCleared]);

  const showDropzone = !preview;

  // ----------------- VARIANT: INPUT -----------------
  if (variant === "input") {
    return (
      <Stack width="100%" spacing={0.5}>
        {/* Input box */}
        <Box
          sx={{
            position: "relative",
            width: "100%",
            height: "70px", // adjust height (can match TextField size)
            borderRadius: 1,
            border: "1px solid",
            borderColor: error ? "error.main" : "divider",
            overflow: "hidden",
            bgcolor: "background.paper",
            cursor: "pointer",
          }}
        >
          {preview ? (
            <>
              {/* Full image preview */}
              <img
                src={preview}
                alt="preview"
                style={{
                  objectFit: "cover",
                }}
                height={"100%"}
                width={"100%"}
              />

              {/* Delete overlay button */}
              <IconButton
                size="small"
                onClick={() => {
                  setPreview(null);
                  onChange?.(null);
                  setImageCleared(true);
                }}
                sx={{
                  position: "absolute",
                  top: 4,
                  right: 4,
                  bgcolor: "rgba(0,0,0,0.5)",
                  color: "white",
                  "&:hover": { bgcolor: "rgba(0,0,0,0.7)" },
                }}
              >
                <Delete fontSize="small" />
              </IconButton>
            </>
          ) : (
            <label
              htmlFor={`${name}-file-input`}
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <input
                type="file"
                id={`${name}-file-input`}
                accept="image/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const previewURL = URL.createObjectURL(file);
                    setPreview(previewURL);
                    onChange?.(file);
                  }
                }}
              />
              <Typography variant="body2" fontWeight={600}>
                {t("uploadImage")}
              </Typography>
              <CloudUpload fontSize="large" color="action" />
            </label>
          )}
        </Box>

        {/* Error message */}
        {error && (
          <Typography color="error" fontSize={12}>
            {error.message}
          </Typography>
        )}
      </Stack>
    );
  }

  // ----------------- VARIANT: DRAG (DEFAULT) -----------------
  return (
    <Stack width={"100%"} alignItems={"center"} justifyContent={"center"}>
      {showDropzone ? (
        <Dropzone
          onDrop={handleDrop}
          accept={accept}
          maxSize={maxSize}
          maxFiles={1}
          multiple={false}
          disabled={disabled || loading}
        >
          {(props) => {
            const { getRootProps, getInputProps, isDragActive } = props;
            return (
              <Box
                {...getRootProps()}
                sx={{
                  border: "2px dashed",
                  borderColor: isDragActive
                    ? "primary.main"
                    : error
                    ? "error.main"
                    : "grey.400",
                  borderRadius: 2,
                  p: {
                    xs: 4,
                    md: 2,
                    lg: 4,
                  },
                  textAlign: "center",
                  bgcolor: isDragActive ? "grey.100" : "background.paper",
                  cursor: "pointer",
                  opacity: disabled ? 0.6 : 1,
                  width: width ? width : 200,
                  height: height ? height : 200,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <input {...getInputProps()} />
                <CloudUpload sx={{ fontSize: 40, color: "grey.500" }} />
                <Typography mt={2} fontSize={14} variant="body2">
                  {t("uploadImagePrompt")}
                </Typography>
              </Box>
            );
          }}
        </Dropzone>
      ) : (
        <Box
          position="relative"
          width={width ? width : 200}
          height={height ? height : 200}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          sx={{
            borderRadius: 2,
            overflow: "hidden",
            border: "1px solid #ccc",
            cursor: "pointer",
          }}
        >
          {preview && (
            <img
              src={preview}
              alt="Uploaded image"
              style={{ objectFit: "contain" }}
              width={"100%"}
              height={"100%"}
            />
          )}

          {!disabled && hovered && (
            <Box
              position="absolute"
              top={0}
              left={0}
              right={0}
              bottom={0}
              bgcolor="rgba(0,0,0,0.5)"
              display="flex"
              alignItems="center"
              justifyContent="center"
              gap={2}
            >
              <IconButton
                onClick={() => {
                  setPreview(null);
                  setImageCleared(true);
                  onChange(null);
                }}
                disabled={loading || (progress !== undefined && progress < 100)}
                color="error"
                size="large"
              >
                <Delete fontSize="large" />
              </IconButton>
            </Box>
          )}
        </Box>
      )}

      {error && (
        <Typography color="error" fontSize={12} mt={1}>
          {error.message}
        </Typography>
      )}
    </Stack>
  );
}

// Helper
