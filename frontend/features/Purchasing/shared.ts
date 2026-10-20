import { toast } from "sonner";

export const AMOUNT = /^\d+(\.\d{1,2})?$/;

/** A decimal amount as minor units, for showing totals while typing. The server re-parses it exactly. */
export const inputToMinor = (text: string) => (AMOUNT.test(text) ? Math.round(Number(text) * 100) : 0);

export const toastError = (error: any, fallback: string) => {
  const message = error?.response?.data?.message;
  toast.error((Array.isArray(message) ? message[0] : message) ?? fallback);
};

/** Today as the `YYYY-MM-DD` a date input shows. */
export const todayInput = () => new Date().toISOString().slice(0, 10);
