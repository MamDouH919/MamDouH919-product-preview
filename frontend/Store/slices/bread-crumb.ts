import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { RootState } from '../store'
import { Icons } from '@/components/breadcrumbs'

interface BreadCrumb {
    id?: string,
    title: string,
    link?: string,
}

type IconKey = keyof typeof Icons

interface BreadCrumbButtons {
    id?: string,
    link?: string,
    icon: IconKey,
    title: string
}

export interface BreadCrumbState {
    breadCrumb: BreadCrumb[] | null,
    breadCrumbBtns?: BreadCrumbButtons[] | null,
    listPage?: boolean,
}


const initialState: BreadCrumbState = {
    breadCrumb: null,
    breadCrumbBtns: null,
    listPage: false,
}

export const breadCrumbSlice = createSlice({
    name: 'breadCrumb',
    initialState,
    reducers: {
        changeBreadCrumb: (state, action: PayloadAction<BreadCrumb[] | null>) => {
            state.breadCrumb = action.payload
        },

        resetBreadCrumb: (state) => {
            state.breadCrumb = initialState.breadCrumb
        },

        changeBreadCrumbActions: (state, action: PayloadAction<BreadCrumbState>) => {
            state.breadCrumb = action.payload.breadCrumb
            state.breadCrumbBtns = action.payload.breadCrumbBtns
            state.listPage = action.payload.listPage
        },

        resetBreadCrumbActions: (state) => {
            state.breadCrumb = initialState.breadCrumb
            state.breadCrumbBtns = initialState.breadCrumbBtns
            state.listPage = initialState.listPage
        }
    },
})

export const {
    changeBreadCrumb,
    resetBreadCrumb,
    changeBreadCrumbActions,
    resetBreadCrumbActions
} = breadCrumbSlice.actions

export const selectBreadCrumb = (state: RootState) => state.breadCrumb

export default breadCrumbSlice.reducer