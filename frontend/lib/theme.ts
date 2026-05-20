// src/theme.ts
import { createTheme } from '@mui/material/styles';
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
      borderRadius: 15,
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
  });
}
