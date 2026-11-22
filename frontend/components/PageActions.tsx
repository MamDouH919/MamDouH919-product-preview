"use client";

import { ReactNode, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Button, ButtonProps } from "@mui/material";

export const PAGE_ACTIONS_SLOT_ID = "page-actions-slot";

/**
 * Renders its children inside the breadcrumb bar, next to the page's main action.
 * Redux can't hold click handlers, so pages that need live buttons (export, import …)
 * put them here instead of in `breadCrumbBtns`.
 */
const PageActions = ({ children }: { children: ReactNode }) => {
  // The slot lives in the layout, outside React's data flow: read it from the DOM,
  // and stay null on the server and during hydration.
  const slot = useSyncExternalStore(
    () => () => {},
    () => document.getElementById(PAGE_ACTIONS_SLOT_ID),
    () => null,
  );

  return slot ? createPortal(children, slot) : null;
};

/** A secondary button sized for the breadcrumb bar. */
export const PageActionButton = (props: ButtonProps) => (
  <Button
    size="small"
    variant="outlined"
    color="inherit"
    {...props}
    sx={{ height: 34, borderRadius: 2.5, borderColor: "divider", whiteSpace: "nowrap", ...props.sx }}
  />
);

export default PageActions;

/** The page's main call to action ("new …"), filled like the breadcrumb's "add" button. */
export const PagePrimaryButton = (props: ButtonProps) => (
  <Button
    size="small"
    variant="contained"
    disableElevation
    {...props}
    sx={{ height: 34, borderRadius: 2.5, px: 1.75, fontWeight: 600, whiteSpace: "nowrap", ...props.sx }}
  />
);
