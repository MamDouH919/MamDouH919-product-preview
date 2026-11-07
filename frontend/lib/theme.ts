// src/theme.ts
import { createTheme } from '@mui/material/styles';
import { arEG, enUS } from '@mui/material/locale';
import { Cairo } from "next/font/google";

// Import Cairo font from Google Fonts via Next.js
const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-cairo",
});

export default function getTheme({
  primary,
  secondary,
  dir
}: {
  primary: string,
  secondary: string,
  dir: "ltr" | "rtl"
}) {
  return createTheme({
    direction: dir,
    shape: {
      borderRadius: 7,
    },
    components: {
      MuiInputBase: {
        styleOverrides: {
          input: {
            fontSize: '16px',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            fontWeight: 700,
          },
        },
      },
      MuiIcon: {
        styleOverrides: {
          root: {
            fontFamily: "'Material Icons Outlined' !important",
          },
        },
      },
      MuiToolbar: {
        styleOverrides: {
          root: {
            textTransform: "capitalize",
          },
        },
      },
      MuiTablePagination: {
        styleOverrides: {
          // MuiToolbar capitalizes every word, and MuiInputBase forces 16px on
          // inputs, which makes the page-size value larger than the labels.
          // The small-input padding (1px/5px) also lifts it off the text baseline.
          toolbar: {
            textTransform: "none",
          },
          input: {
            "& .MuiInputBase-input": {
              fontSize: "inherit",
              paddingTop: 3,
              paddingBottom: 3,
            },
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            padding: "0 16px",
            maxHeight: "45px",
            height: "45px",
            whiteSpace: "nowrap",
          },
        },
      },
      MuiSelect: {
        defaultProps: {
          variant: "filled",
          size: "small",
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
          },
        },
      },
      MuiFormControl: {
        styleOverrides: {
          root: {
            "& label ,& input ,& .MuiSelect-select": {},
          },
        },
      },
      MuiTextField: {
        defaultProps: {
          size: "small",
        },
      },
    },

    palette: {
      primary: {
        main: primary,
      },
      secondary: {
        main: secondary,
      },
      background: {
        default: "#fafafa",
        paper: "#fff",
      },
    },

     typography: {
      fontFamily: cairo.style.fontFamily,
      fontSize: 12.5,
    },
  },
  dir === "rtl" ? arEG : enUS,
  dir === "rtl" ? {
    components: {
      MuiTablePagination: {
        defaultProps: {
          // Isolate the range as LTR, otherwise the bidi algorithm flips "1–25" to "25–1".
          labelDisplayedRows: ({ from, to, count }: { from: number; to: number; count: number }) =>
            `\u2066${from}–${to}\u2069 من ${count !== -1 ? count : `أكثر من ${to}`}`,
        },
      },
    },
  } : {});
}
