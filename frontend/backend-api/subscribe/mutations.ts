import customerApi from "@/lib/customerApi";

/** Newsletter sign-up. Same reply whether or not the address was already on the list. */
export const subscribeToNewsletter = async (email: string): Promise<{ message: string }> => {
  // The public axios instance: no admin session involved, and no redirect on 401.
  const response = await customerApi.post("/subscribe", { email }, { skipAuthRedirect: true });
  return response.data;
};
