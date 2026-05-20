import {
    Facebook,
    Instagram,
    LinkedIn,
    Twitter,
    YouTube,
    Language,
    Telegram,
    GitHub,
    WhatsApp,
} from "@mui/icons-material";
import { SvgIconProps } from "@mui/material";
import React from "react";

export type SocialMediaOption = {
    key: string;
    label: string;
    Icon: React.ComponentType<SvgIconProps>;
    color: string;
};

export const SOCIAL_MEDIA_OPTIONS: SocialMediaOption[] = [
    { key: "facebook",  label: "Facebook",  Icon: Facebook,  color: "#1877F2" },
    { key: "instagram", label: "Instagram", Icon: Instagram, color: "#E1306C" },
    { key: "linkedin",  label: "LinkedIn",  Icon: LinkedIn,  color: "#0A66C2" },
    { key: "twitter",   label: "X / Twitter", Icon: Twitter, color: "#000000" },
    { key: "youtube",   label: "YouTube",   Icon: YouTube,   color: "#FF0000" },
    { key: "whatsapp",  label: "WhatsApp",  Icon: WhatsApp,  color: "#25D366" },
    { key: "telegram",  label: "Telegram",  Icon: Telegram,  color: "#229ED9" },
    { key: "github",    label: "GitHub",    Icon: GitHub,    color: "#181717" },
    { key: "website",   label: "Website",   Icon: Language,  color: "#555555" },
];

export const getSocialOption = (key: string): SocialMediaOption | undefined =>
    SOCIAL_MEDIA_OPTIONS.find((o) => o.key === key.toLowerCase());
