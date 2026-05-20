import { ChevronLeft, ChevronRight, Clear } from "@mui/icons-material";
import { DatePickerProps } from "@mui/lab";
import {
  FormControl,
  FormHelperText,
  FormLabel,
  IconButton,
  Stack,
  TextFieldProps,
  useTheme
} from "@mui/material";
import { CalendarIcon, DatePicker } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { isAfter, isBefore, isValid, startOfDay } from "date-fns";
import { useRef, useState } from "react";
import { Control, Controller } from "react-hook-form";
// import useWidth, { isWidthDown } from "../../hooks/useWidth";

interface IProps extends Omit<DatePickerProps<Date>, "onChange" | "value"> {
  name: string;
  label: string;
  control?: Control<any>;
  onChangeFunction?: () => void;
  showDefault?: boolean;
  inputProps?: TextFieldProps;
  clearable?: boolean;
  disableFuture?: boolean;
  disablePast?: boolean;
  minDate?: Date;
  maxDate?: Date;
  required?: boolean;
  defaultToday?: boolean;
  shouldDisableDate?: (day: any) => boolean;
  onError?: (reason: string) => void;
}

const DatePickerComponent = ({
  control,
  name,
  label,
  onChangeFunction,
  // showDefault = true,
  inputProps,
  clearable = true,
  disableFuture = false,
  disablePast = false,
  minDate,
  maxDate,
  required = false,
  shouldDisableDate,
  onError,
  disabled,
  ...restprops
}: IProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);
  // const screenWidth = useWidth();
  // const isMobile = isWidthDown("sm", screenWidth);
  const dateRef = useRef<HTMLInputElement>(null);
  const { direction } = useTheme();

  const validateDate = (value: any): string | true => {
    if (required && !value) {
      return "This field is required";
    }

    if (!value) {
      return true;
    }

    if (!isValid(value)) {
      return "Invalid date";
    }

    const year = value.getFullYear();
    if (year < 1000 || year > 9999) {
      return "Please enter a valid year";
    }

    if (shouldDisableDate && shouldDisableDate(value)) {
      return "should disable date";
    }

    if (disablePast) {
      const today = startOfDay(new Date());
      if (isBefore(startOfDay(value), today)) {
        return (
          "Past dates are not allowed"
        );
      }
    }

    if (disableFuture) {
      const today = startOfDay(new Date());
      if (isAfter(startOfDay(value), today)) {
        return (
          "Future dates are not allowed"
        );
      }
    }

    if (minDate && isBefore(startOfDay(value), startOfDay(minDate))) {
      return (
        `Date must be after ${minDate.toLocaleDateString()}`
      );
    }

    if (maxDate && isAfter(startOfDay(value), startOfDay(maxDate))) {
      return (
        `Date must be before ${maxDate.toLocaleDateString()}`
      );
    }

    if (year < 1900 || year > 2100) {
      return (
        "Date is out of valid range (1900-2100)"
      );
    }

    return true;
  };

  return (
    <Controller
      control={control}
      name={name}
      rules={{
        validate: validateDate,
      }}
      render={({
        field: { onChange: fieldChange, value: fieldValue },
        fieldState: { error },
      }) => {
        if (fieldValue) {
          if (typeof fieldValue === "string") {
            fieldValue = new Date(fieldValue);
          }
        }

        const displayError =
          error || (internalError ? { message: internalError } : null);

        return (
          <LocalizationProvider
            dateAdapter={AdapterDateFns}
          >
            <Stack spacing={0.5}>
              <FormLabel error={Boolean(displayError)}>
                {required ? `${label} *` : label}
              </FormLabel>
              <FormControl
                variant="outlined"
                fullWidth
                size="small"
                error={Boolean(displayError)}
              >
              <DatePicker
                slots={{
                  leftArrowIcon: () =>
                    direction === "rtl" ? <ChevronRight /> : <ChevronLeft />,
                  rightArrowIcon: () =>
                    direction === "rtl" ? <ChevronLeft /> : <ChevronRight />,
                }}
                slotProps={{
                  textField: {
                    variant: "outlined",
                    size: "small",
                    fullWidth: true,
                    placeholder: label,
                    onClick: () => setIsOpen(true),
                    InputProps: {
                      endAdornment: (
                        <>
                          {/* ✅ SOLUTION: Clear button positioned relative to the Box, not FormControl */}
                          {(('value' in restprops ? restprops.value : fieldValue) && clearable && !disabled) && (
                            <IconButton
                              onClick={(e) => {
                                e.stopPropagation();
                                setInternalError(null);
                                fieldChange(null);
                                onChangeFunction?.();

                                // Call custom onChange if provided
                                if (restprops?.onChange) {
                                  restprops?.onChange(null);
                                }
                              }}
                              sx={{
                                position: "absolute",
                                right: 45,
                                top: "50%",
                                transform: "translateY(-50%)",
                                p: 0.5,
                              }}
                            >
                              <Clear fontSize="small" />
                            </IconButton>
                          )}
                          <IconButton
                            onClick={() => setIsOpen(true)}
                            disabled={inputProps?.disabled || disabled}
                          >
                            <CalendarIcon fontSize="medium" />
                          </IconButton>
                        </>
                      ),
                    },
                    error: Boolean(displayError),
                    ...inputProps,
                  },
                  popper: {
                    sx: {
                      "& .MuiDayCalendar-header , .MuiPickersSlideTransition-root":
                      {
                        direction,
                      },
                    },
                  },
                }}
                ref={dateRef}
                value={'value' in restprops ? restprops.value : fieldValue ?? null}
                onChange={(newValue) => {
                  const validationResult = validateDate(newValue);

                  if (validationResult === true) {
                    setInternalError(null);
                  } else {
                    setInternalError(validationResult);
                  }

                  fieldChange(newValue);
                  if (onChangeFunction) {
                    onChangeFunction();
                  }
                }}
                onError={(error) => {
                  if (error) {
                    let errorMessage: string;

                    switch (error) {
                      case "invalidDate":
                        errorMessage =
                          "Invalid date";
                        break;
                      case "disablePast":
                        errorMessage =
                          "Past dates are not allowed";
                        break;
                      case "disableFuture":
                        errorMessage =
                          "Future dates are not allowed";
                        break;
                      case "minDate":
                        errorMessage =
                          "Date is before minimum allowed date";
                        break;
                      case "maxDate":
                        errorMessage =
                          "Date is after maximum allowed date";
                        break;
                      case "shouldDisableDate":
                        errorMessage = "should disable date";
                        break;
                      default:
                        errorMessage =
                          "Invalid date";
                    }

                    setInternalError(errorMessage);
                    if (onError) {
                      onError(error);
                    }
                  } else {
                    setInternalError(null);
                  }
                }}
                
                shouldDisableDate={shouldDisableDate}
                disableFuture={disableFuture}
                disablePast={disablePast}
                minDate={minDate}
                maxDate={maxDate}
                onClose={() => setIsOpen(false)}
                open={isOpen}
                closeOnSelect
                disabled={disabled}
                {...restprops}
              />

              {displayError && (
                <FormHelperText>{displayError.message}</FormHelperText>
              )}
            </FormControl>
            </Stack>
          </LocalizationProvider>
        );
      }}
    />
  );
};

export default DatePickerComponent;
