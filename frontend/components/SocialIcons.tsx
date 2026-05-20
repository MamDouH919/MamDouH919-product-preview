"use client"
import { Fab, Stack } from "@mui/material";
import { styled } from "@mui/material/styles";
import clsx from "clsx";
import { FaArrowUp, FaPhone, FaWhatsapp } from "react-icons/fa";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAppSelector } from "@/Store/store";

const PREFIX = "SocialIcons";

const classes = {
  icons: `${PREFIX}-icons`,
  messengerIcon: `${PREFIX}-messengerIcon`,
  whatsappIcon: `${PREFIX}-whatsappIcon`,
  toTop: `${PREFIX}-toTop`,
  visible: `${PREFIX}-visible`,
  tiktokIcon: `${PREFIX}-tiktokIcon`,
};

const StyledIconButton = styled(Stack)(({ theme }) => ({
  [`&.${classes.icons}`]: {
    position: "fixed",
    right: 10,
    bottom: 10,
    zIndex: 100
  },
  [`& a`]: {
    margin: theme.spacing(1, 0),
  },
  [`& .${classes.whatsappIcon}`]: {
    backgroundColor: "#25d450",
    color: "#FFF",
    fontSize: "35px",
    cursor: "pointer",
    [`&:hover`]: {
      backgroundColor: "#24ab07",
    },
  },
  [`& .${classes.messengerIcon}`]: {
    backgroundColor: "#2196f3",
    color: "#FFF",
    fontSize: "30px",
    cursor: "pointer",
    [`&:hover`]: {
      backgroundColor: "#0b7acc",
    },
  },
  [`& .${classes.tiktokIcon}`]: {
    backgroundColor: "#000",
    color: "#FFF",
    fontSize: "30px",
    cursor: "pointer",
    [`&:hover`]: {
      background: "#000", // solid color on hover
    },
  },
  [`& .${classes.toTop}`]: {
    opacity: 0,
    visibility: "hidden",
    transition: "opacity 1s ease, visibility 0s 0.5s", // Visibility change happens after 1s
    backgroundColor: theme.palette.primary.light,
    color: "#FFF",
    fontSize: "22px",
    cursor: "pointer",
    [`&:hover`]: {
      backgroundColor: theme.palette.primary.main,
    },
  },
  [`& .${classes.visible}`]: {
    opacity: 1,
    visibility: "visible",
    transition: "opacity 0.5s ease, visibility 0s", // Visibility change happens immediately
  },
}));

const SocialIcons: React.FC = () => {
  const [shouldShowHeader, setShouldShowHeader] = useState(false);
  const listenToScroll = () => {
    setShouldShowHeader(window.pageYOffset > 300);
  };
  useEffect(() => {
    window.addEventListener("scroll", listenToScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", listenToScroll);
    };
  }, []);

  const { settings } = useAppSelector((state) => state)

  return (
    <StyledIconButton spacing={2} className={clsx(classes.icons)}>
      <Fab
        className={clsx({ [classes.visible]: shouldShowHeader }, classes.toTop)}
        aria-label="toTop"
        onClick={() =>
          window.scrollTo({
            top: 0,
            left: 0,
            behavior: "smooth",
          })
        }
      >
        <FaArrowUp />
      </Fab>

      {settings?.phone && (
        <Link
          target="_blank"
          rel="noopener noreferrer"
          title="mobile"
          href={`tel:${settings?.phone}`}
        >
          <Fab className={classes.messengerIcon} aria-label="messenger">
            <FaPhone />
          </Fab>
        </Link>
      )}

      {settings?.whatsapp && (
        <Link
          target="_blank"
          rel="noopener noreferrer"
          title="whatsApp"
          href={`https://wa.me/${settings?.whatsapp}`}
        >
          <Fab className={classes.whatsappIcon} aria-label="whatsapp">
            <FaWhatsapp />
          </Fab>
        </Link>
      )}


    </StyledIconButton>
  );
};

export default SocialIcons;