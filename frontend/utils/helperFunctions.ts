import imageCompression from 'browser-image-compression';
import { getBackendUrl, getTenantKey } from '@/lib/getBackendUrl';

export const getBackendUri = (imgPath: string | undefined | null): string => {
    if (!imgPath) return "/images/placeholder.png";
    const domain = getBackendUrl();
    const key = getTenantKey()
    if (!domain) return "/images/placeholder.png";
    return `${domain}${imgPath}`;
};


export const handleCompression = async (originalImage: File) => {
    if (!originalImage) return;

    const options = {
        maxSizeMB: 0.8,           // Maximum size in MB (e.g., 1 MB)
        useWebWorker: true,     // Use web workers for performance if available
        fileType: 'image/webp', // Output file type
        quality: 1,           // Quality (0 to 1, works for JPEG and WEBP)
    };

    try {
        const compressedFile = await imageCompression(originalImage, options);
        return compressedFile;
    } catch (error) {
        console.error(error);
    }
};

export function getLocalizedString(field: any, locale: string): string {
    if (!field) return "";
    if (typeof field === "string") return field;
    return field[locale] || "";
}