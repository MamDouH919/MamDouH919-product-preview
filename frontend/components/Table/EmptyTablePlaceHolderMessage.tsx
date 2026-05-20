import { IconButton, Paper, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

import { AddCircleOutline, Delete, QrCodeScanner } from "@mui/icons-material";
import TableLoading from "./TableLoading";

const EmptyTablePlaceHolderMessage = ({
  headingText,
  showAddIcon,
  showBarcodeIcon,
  message,
  headerComponent,
  showDeleteIcon,
  radius = 0,
  py,
  loading,
  minHeight = 300,
  elevation,
}: {
  message?: string;
  headingText?: string;
  showAddIcon?: boolean;
  showDeleteIcon?: boolean;
  showBarcodeIcon?: boolean;
  headerComponent?: React.ReactNode;
  radius?: number;
  py?: number;
  loading?: boolean;
  minHeight?: number;
  elevation?: number;
}) => {
  const { t } = useTranslation();

  return (
    <Stack
      minHeight={minHeight}
      borderRadius={radius ?? 0}
      width={"100%"}
      height={"100%"}
      component={Paper}
      spacing={2}
      justifyContent={"center"}
      alignItems={"center"}
      elevation={elevation}
    >
      {(headingText || showAddIcon || headerComponent || showBarcodeIcon) && (
        <Stack py={py ?? 2} px={3} width={"100%"} borderColor={"#444444"}>
          {headerComponent && headerComponent}
          <Stack
            flexDirection={"row"}
            justifyContent={!headingText ? "flex-end" : "space-between"}
            alignItems={"center"}
          >
            {headingText && (
              <Typography
                variant="subtitle1"
                textTransform={"capitalize"}
                fontWeight={600}
                color="text.primary"
              >
                {t(headingText)}
              </Typography>
            )}
            <Stack flexDirection={"row"} justifyContent={"flex-end"}>
              {showBarcodeIcon && (
                <IconButton disabled>
                  <QrCodeScanner />
                </IconButton>
              )}
              {showAddIcon && (
                <IconButton disabled>
                  <AddCircleOutline />
                </IconButton>
              )}
              {showDeleteIcon && (
                <IconButton disabled>
                  <Delete />
                </IconButton>

              )}
            </Stack>
          </Stack>
        </Stack>
      )}

      {loading ? (
        <TableLoading />
      ) : (
        <Stack justifyContent={"center"} alignItems={"center"} flex={1}>
          {/* <TbDeviceDesktopSearch size={80} color="#808080" /> */}
          <Typography color="#808080" fontSize={20} fontWeight={600}>
            {t(message || "noResult")}
          </Typography>
        </Stack>
      )}
    </Stack>
  );
};

export default EmptyTablePlaceHolderMessage;
