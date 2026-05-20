import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { RootState } from '../store'

interface User {
    name: string,
    email: string,
    id: string
}

export interface AuthState {
    isLoggedIn: boolean,
    isInitialized: boolean,
    role: string,
    isSuper: boolean,
    user: User | null,
}

const initialState: AuthState = {
    isLoggedIn: false,
    isInitialized: false,
    role: "",
    isSuper: false,
    user: null,
}

export const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        changeIsLogged: (state, action: PayloadAction<boolean>) => {
            state.isLoggedIn = action.payload
        },
        changeRole: (state, action: PayloadAction<string>) => {
            state.isLoggedIn = true
            state.role = action.payload
        },
        changeUser: (state, action: PayloadAction<User | null>) => {
            state.user = action.payload
        },
        changeAuthData: (state, action: PayloadAction<Partial<AuthState>>) => {
            if (action.payload.user !== undefined) {
                state.user = action.payload.user;
            }
            if (action.payload.isLoggedIn !== undefined) {
                state.isLoggedIn = action.payload.isLoggedIn;
            }
            if (action.payload.role !== undefined) {
                state.role = action.payload.role;
            }
            if (action.payload.isSuper !== undefined) {
                state.isSuper = action.payload.isSuper;
            }
            if (action.payload.isInitialized !== undefined) {
                state.isInitialized = action.payload.isInitialized;
            }
        },
        resetAuthData: (state) => {
            state.isLoggedIn = false;
            state.isInitialized = true;
            state.role = initialState.role;
            state.user = initialState.user;
        }
    },
})

export const {
    changeIsLogged,
    changeRole,
    resetAuthData,
    changeUser,
    changeAuthData,
} = authSlice.actions

export const selectAuth = (state: RootState) => state.auth

export default authSlice.reducer
