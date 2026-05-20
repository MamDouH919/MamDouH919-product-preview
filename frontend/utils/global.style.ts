import { AddCircleOutline, Delete } from "@mui/icons-material";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";

import Container from "@mui/material/Container";
import { styled } from "@mui/material/styles";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import { HighlightOff as HighlightOffIconn } from "@mui/icons-material";
import ModeEditIcon from "@mui/icons-material/ModeEdit";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import VisibilityIcon from '@mui/icons-material/Visibility';
import { Box, Card, CardContent, Chip, Stack } from "@mui/material";
import Link from "next/link";

export const StyledContainer = styled(Container)(({ theme }) => ({
  padding: theme.spacing(2),
}));

export const StyledSection = styled(Stack)(({ theme }) => ({
  padding: theme.spacing(2),
  width: "100%",
  paddingBottom: 2,
}));

export const ColorSpan = styled("span")(({ theme }) => ({
  color: theme.palette.primary.main,
  margin: "0 4px",
  fontWeight: "bold",
}));

export const StyledLink = styled(Link)(({ theme }) => ({
  color: theme.palette.primary.main,
  textDecoration: "none",
  maxWidth: "fit-content",
  fontWeight: 500,
  "&:hover": {
    textDecoration: "underline",
    color: theme.palette.primary.main,
    cursor: "pointer",
  },
}));
export const SuccessCheckCircleIcon = styled(CheckCircleOutlineIcon)(
  ({ theme }) => ({
    color: theme.palette.success.main,
    fontSize: 24,
    lineHeight: "24px",
    verticalAlign: "middle",
  })
);

export const HighlightOffIcon = styled(HighlightOffIconn)(() => ({
  color: "#f44336",
  fontSize: 24,
  lineHeight: "24px",
  verticalAlign: "middle",
}));

export const BarcodeIcon = styled(QrCodeScannerIcon)(() => ({
  fontSize: 22,
  marginTop: 1,
  "&.Mui-disabled": {
    color: "#565758",
  },
}));
export const AddIcon = styled(AddCircleOutline)(() => ({
  fontSize: 22,
  marginTop: 1,
}));
export const PenIcon = styled(ModeEditIcon)(() => ({
  fontSize: 25,
  marginTop: 1,
}));
export const VisibleIcone = styled(VisibilityIcon)(() => ({
  fontSize: 25,
  marginTop: 1,
}));
export const DeleteIcon = styled(Delete)(() => ({
  // color: "white",
  fontSize: 22,
  marginTop: 1,
  // "&.Mui-disabled": {
  //   color: "#565758",
  // },
}));

export const CopyIcon = styled(ContentCopyIcon)(() => ({
  color: "#929496",
  fontSize: 25,
  marginTop: 1,
}));

export const BarcodeBox = styled("span")(() => ({
  fontFamily: "'Libre Barcode 39 Text', cursive",
  fontSize: 32,
}));

interface StyledChipProps {
  colorcode: string;
}

export const StyledChip = styled(Chip)<StyledChipProps>(
  ({ theme, colorcode }) => ({
    color: theme.palette.getContrastText(colorcode),
    backgroundColor: `${colorcode} !important`,
    height: 22,
    fontSize: "0.7rem",
  })
);

export const SpanLikeLink = styled("span", {
  shouldForwardProp: (prop) => prop !== "loading",
})<{ loading?: boolean }>(({ theme, loading }) => ({
  color: loading ? theme.palette.action.disabled : theme.palette.primary.main,
  textDecoration: "none",
  fontWeight: 500,
  cursor: loading ? "not-allowed" : "pointer",
  pointerEvents: loading ? "none" : "auto",
  opacity: loading ? 0.6 : 1,

  "&:hover": {
    textDecoration: loading ? "none" : "underline",
    color: loading
      ? theme.palette.action.disabled
      : theme.palette.primary.main,
  },
}));

export const CardStyle = styled(Card)(({ theme }) => ({
  position: 'relative',
  overflow: 'hidden',
  borderRadius: theme.spacing(1),
  backgroundColor: theme.palette.background.paper,
  transition: theme.transitions.create('transform', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  '&:before': {
    display: 'block',
    content: "''",
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0.5), rgba(0,0,0,0))',
    transition: theme.transitions.create('opacity'),
  },
  '&:hover': {
    transform: 'scale(1.02)',
    boxShadow: theme.shadows[4],
    '&:before': {
      opacity: 0,
    },
  },
}));

export const CardContentStyle = styled(CardContent)(({ theme }) => ({
  position: 'absolute',
  bottom: 20,
  left: "50%",
  transform: "translateX(-50%)",
  backgroundColor: theme.alpha(theme.palette.primary.main, 0.6),
  color: theme.palette.getContrastText(theme.palette.primary.main),
  padding: theme.spacing(2),
  borderRadius: theme.spacing(2),
}));

export const LogoWrapper = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  width: 'auto',
  height: 60,

  [theme.breakpoints.down('md')]: {
    height: 50,
  }
}));
export const LogoWrapperDashboard = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'flex-start',
  width: 100,
  height: 60,
  position: 'relative',
  [theme.breakpoints.down('md')]: {
    height: 43,
  }
}));


export const HeroBanner = styled(Box)(({ theme }) => ({
  position: "relative",
  height: 400,
  marginTop: -100,
  paddingTop: 100,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundImage: "url(/covers/banner-single.webp)",
  backgroundSize: "cover",
  backgroundPosition: "center",
  "&::before": {
    content: '""',
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  [theme.breakpoints.down("md")]: {
    height: 280,
    paddingTop: 60,
  },
  [theme.breakpoints.down("sm")]: {
    height: 240,
    paddingTop: 60,
  },
}));

export const HeroContent = styled(Box)(({ theme }) => ({
  position: "relative",
  zIndex: 1,
  textAlign: "center",
  color: "#fff",
  padding: theme.spacing(0, 2),
  "& h3": {
    fontSize: "2.4rem",
    fontWeight: 800,
    lineHeight: 1.2,
    [theme.breakpoints.down("md")]: {
      fontSize: "1.6rem",
    },
    [theme.breakpoints.down("sm")]: {
      fontSize: "1.3rem",
    },
  },
}));
