import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { RootState } from "../store";
import { Customer } from "@/backend-api/customers/types";

export interface CustomerState {
  isLoggedIn: boolean;
  /** False until the session has been checked, so guards don't flash. */
  isInitialized: boolean;
  customer: Customer | null;
}

const initialState: CustomerState = {
  isLoggedIn: false,
  isInitialized: false,
  customer: null,
};

export const customerSlice = createSlice({
  name: "customer",
  initialState,
  reducers: {
    setCustomer: (state, action: PayloadAction<Customer | null>) => {
      state.customer = action.payload;
      state.isLoggedIn = !!action.payload;
      state.isInitialized = true;
    },
    setCustomerInitialized: (state, action: PayloadAction<boolean>) => {
      state.isInitialized = action.payload;
    },
    resetCustomer: (state) => {
      state.customer = null;
      state.isLoggedIn = false;
      state.isInitialized = true;
    },
  },
});

export const { setCustomer, setCustomerInitialized, resetCustomer } =
  customerSlice.actions;

export const selectCustomer = (state: RootState) => state.customer;

export default customerSlice.reducer;
