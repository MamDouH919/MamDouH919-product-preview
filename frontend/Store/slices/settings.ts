import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../store';
import type { StoreModule } from '@/lib/storeModules';

export interface SettingsState {
    siteTitle?: Record<string, string>;
    siteDescription?: Record<string, string>;
    logo?: string;
    favicon?: string;
    primaryColor?: string;
    currency?: Record<string, string>;
    phone?: string;
    whatsapp?: string;
    landLine?: string;
    email?: string;
    address?: string;
    socialMedia?: Record<string, string>[];
    showPrices?: boolean;
    /** Left unset until settings load, and when they fail to; read as every module. */
    modules?: StoreModule[];
}

const initialState: SettingsState = {};

export const settingsSlice = createSlice({
    name: 'settings',
    initialState,
    reducers: {
        setSettings: (state, action: PayloadAction<SettingsState>) => {
            return { ...state, ...action.payload };
        },
        updateColor: (state, action: PayloadAction<string>) => {
            return { ...state, primaryColor: action.payload };
        },
        resetSettings: () => initialState,
    },
});

export const { setSettings, updateColor, resetSettings } = settingsSlice.actions;
export const selectSettings = (state: RootState) => state.settings;

export default settingsSlice.reducer;
