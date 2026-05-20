import React from 'react';
import {
    useTheme,
    Container,
    Box
} from '@mui/material';
import {
    Facebook,
    Instagram,
    LinkedIn,
    YouTube,
    Language,
    WhatsApp,
    X,
    Telegram
} from '@mui/icons-material';

interface SocialMediaLink {
    code: string;
    link: string;
}

// TikTok Icon
const TikTokIcon = () => (
    <svg
        width="55"
        height="55"
        viewBox="0 0 24 24"
        fill="currentColor"
    >
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02c.08 1.53.63 3.09 1.75 4.17c1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97c-.57-.26-1.1-.59-1.62-.93c-.01 2.92.01 5.84-.02 8.75c-.08 1.4-.54 2.79-1.35 3.94c-1.31 1.92-3.58 3.17-5.91 3.21c-1.43.08-2.86-.31-4.08-1.03c-2.02-1.19-3.44-3.37-3.65-5.71c-.02-.5-.03-1-.01-1.49c.18-1.9 1.12-3.72 2.58-4.96c1.66-1.44 3.98-2.13 6.15-1.72c.02 1.48-.04 2.96-.04 4.44c-.99-.32-2.15-.23-3.02.37c-.63.41-1.11 1.04-1.36 1.75c-.21.51-.15 1.07-.14 1.61c.24 1.64 1.82 3.02 3.5 2.87c1.12-.01 2.19-.66 2.77-1.61c.19-.33.4-.67.41-1.06c.1-1.79.06-3.57.07-5.36c.01-4.03-.01-8.05.02-12.07z" />
    </svg>
);

// Snapchat Icon
const SnapchatIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg"
        width="55"
        height="55"
        viewBox="0 0 24 24">
        <path d="M5.829 4.533c-.6 1.344-.363 3.752-.267 5.436-.648.359-1.48-.271-1.951-.271-.49 0-1.075.322-1.167.802-.066.346.089.85 1.201 1.289.43.17 1.453.37 1.69.928.333.784-1.71 4.403-4.918 4.931-.251.041-.43.265-.416.519.056.975 2.242 1.357 3.211 1.507.099.134.179.7.306 1.131.057.193.204.424.582.424.493 0 1.312-.38 2.738-.144 1.398.233 2.712 2.215 5.235 2.215 2.345 0 3.744-1.991 5.09-2.215.779-.129 1.448-.088 2.196.058.515.101.977.157 1.124-.349.129-.437.208-.992.305-1.123.96-.149 3.156-.53 3.211-1.505.014-.254-.165-.477-.416-.519-3.154-.52-5.259-4.128-4.918-4.931.236-.557 1.252-.755 1.69-.928.814-.321 1.222-.716 1.213-1.173-.011-.585-.715-.934-1.233-.934-.527 0-1.284.624-1.897.286.096-1.698.332-4.095-.267-5.438-1.135-2.543-3.66-3.829-6.184-3.829-2.508 0-5.014 1.268-6.158 3.833z" fill="#020202" />
    </svg>
);

type SocialConfig = {
    code: "FACEBOOK" | "INSTAGRAM" | "X" | "LINKEDIN" | "YOUTUBE" | "WHATSAPPGROUP" | "WEBSITE" | "TELEGRAM" | "SNAPCHAT" | "TIKTOK";
    name: string;
    icon: React.ReactNode;
    gradient: string;
    nameAr: string;
};

const SOCIAL_CONFIG: SocialConfig[] = [
    {
        code: 'FACEBOOK',
        name: 'Facebook',
        nameAr: 'فيسبوك',
        icon: <Facebook fontSize={"large"} />,
        gradient: 'linear-gradient(135deg, #1877F2, #0D5DBF)'
    },
    {
        code: 'INSTAGRAM',
        name: 'Instagram',
        nameAr: 'إنستغرام',
        icon: <Instagram />,
        gradient:
            'linear-gradient(135deg, #F58529, #DD2A7B, #8134AF, #515BD4)'
    },
    {
        code: 'X',
        name: 'X',
        nameAr: 'X',
        icon: <X />,
        gradient: 'linear-gradient(135deg, #000000, #000000)'
    },
    {
        code: 'LINKEDIN',
        name: 'LinkedIn',
        nameAr: 'لينكد ان',
        icon: <LinkedIn />,
        gradient: 'linear-gradient(135deg, #0077B5, #005885)'
    },
    {
        code: 'YOUTUBE',
        name: 'YouTube',
        nameAr: 'يوتيوب',
        icon: <YouTube />,
        gradient: 'linear-gradient(135deg, #FF0000, #CC0000)'
    },
    {
        code: 'TIKTOK',
        name: 'TikTok',
        nameAr: 'تيكتوك',
        icon: <TikTokIcon />,
        gradient:
            'linear-gradient(135deg, #000000, #EE1D52, #69C9D0)'
    },
    {
        code: 'WHATSAPPGROUP',
        name: 'WhatsApp Group',
        nameAr: 'مجموعة واتس اب',
        icon: <WhatsApp />,
        gradient: 'linear-gradient(135deg, #25D366, #128C7E)'
    },
    {
        code: 'WEBSITE',
        name: 'Website',
        nameAr: 'موقع الويب',
        icon: <Language />,
        gradient: 'linear-gradient(135deg, #6366F1, #8B5CF6)'
    },
    {
        code: "TELEGRAM",
        name: "Telegram",
        nameAr: "تيليجرام",
        icon: <Telegram />,
        gradient: "linear-gradient(135deg, #0088CC, #0088CC)"
    },
    {
        code: "SNAPCHAT",
        name: "Snapchat",
        nameAr: "سنابشت",
        icon: <SnapchatIcon />,
        gradient: "linear-gradient(135deg, #FFFC00, #F2F200)"
    }
];

export default function SocialMediaLinks({
    links
}: {
    links: SocialMediaLink[];
}) {
    const theme = useTheme();
    const isArabic = theme.direction === 'rtl';
    const linksMap = React.useMemo(
        () =>
            Object.fromEntries(
                links.map(l => [
                    l.code,
                    {
                        link: l.link
                    }
                ])
            ),
        [links]
    );


    const availableLinks = SOCIAL_CONFIG
        .filter(social => linksMap[social.code])
        .map(social => ({
            ...social,
            url: linksMap[social.code].link   // ← from API
        }));

    return (
        <Box>
            <Container>
                <Box
                    sx={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        justifyContent: 'center',
                        gap: 3,
                    }}
                >
                    {availableLinks.map((social, index) => (
                        <Box
                            key={index}
                            component="a"
                            href={social.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: 0.75,
                                textDecoration: 'none',
                                animation: `fadeInUp 0.5s ease-out ${index * 0.08}s both`,
                                '@keyframes fadeInUp': {
                                    from: { opacity: 0, transform: 'translateY(20px)' },
                                    to: { opacity: 1, transform: 'translateY(0)' }
                                }
                            }}
                        >
                            <Box
                                sx={{
                                    width: 60,
                                    height: 60,
                                    borderRadius: '22px',
                                    backgroundImage: social.gradient,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#fff',
                                    boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                                    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                                    '&:hover': {
                                        transform: 'scale(1.08)',
                                        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                                    },
                                    '&:active': {
                                        transform: 'scale(0.94)',
                                    },
                                    '& svg': {
                                        fontSize: '50px !important',
                                    },
                                }}
                            >
                                {social.icon}
                            </Box>
                            <Box
                                component="span"
                                sx={{
                                    fontSize: '0.72rem',
                                    fontWeight: 500,
                                    color: 'text.secondary',
                                    textAlign: 'center',
                                }}
                            >
                                {isArabic ? social.nameAr : social.name}
                            </Box>
                        </Box>
                    ))}
                </Box>
            </Container>
        </Box>
    );
}
