import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { RootState } from '../store'


interface TenantState {
    logo: string | null
    currency: string
}

// Define the initial state using that type
const initialState: TenantState = {
    logo: null,
    currency: ""
}

export const tenantSlice = createSlice({
    name: 'tenant',
    // `createSlice` will infer the state type from the `initialState` argument
    initialState,
    reducers: {
        // Use the PayloadAction type to declare the contents of `action.payload`
        updateLogo: (state, action: PayloadAction<string>) => {
            state.logo = action.payload
        },
        // update any i will be the payload
        updateTenantData: (state, action: PayloadAction<TenantState>) => {
            state.logo = action.payload.logo
            state.currency = action.payload.currency;
        },
        resetTenantData: (state) => {
            state.logo = null
        },

    },
})

export const {
    updateLogo,
    resetTenantData,
    updateTenantData
} = tenantSlice.actions

// Other code such as selectors can use the imported `RootState` type
export const selectTenant = (state: RootState) => state.tenant

export default tenantSlice.reducer