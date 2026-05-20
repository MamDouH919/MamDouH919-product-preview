// src/createEmotionCache.ts
import createCache from '@emotion/cache';
import rtlPlugin from 'stylis-plugin-rtl';
import { prefixer } from 'stylis';

export default function createEmotionCache(isRtl: boolean = false) {
    return createCache({
        key: isRtl ? 'mui-rtl' : 'mui',
        stylisPlugins: isRtl ? [prefixer, rtlPlugin] : [],
    });
}
