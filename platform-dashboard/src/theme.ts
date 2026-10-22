import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'class' },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: '#0f766e' },
        background: { default: '#f6f7f9', paper: '#ffffff' },
      },
    },
    dark: {
      palette: {
        primary: { main: '#2dd4bf' },
        background: { default: '#0d1117', paper: '#151b23' },
      },
    },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: '"Inter Variable", system-ui, sans-serif',
    h5: { fontWeight: 650, letterSpacing: '-0.01em' },
    h6: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiPaper: { defaultProps: { variant: 'outlined' } },
    MuiTextField: { defaultProps: { fullWidth: true } },
    MuiTableCell: {
      styleOverrides: {
        head: ({ theme }) => ({
          fontSize: 12,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          color: theme.vars!.palette.text.secondary,
        }),
      },
    },
  },
});
