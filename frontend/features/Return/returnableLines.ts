import { Order } from "@/backend-api/orders/types";
import { ReturnRequest, ReturnableLine } from "@/backend-api/returns/types";

/** Mirrors the server: delivered quantity per line, less what non-rejected returns cover. */
export function returnableLines(order: Order, returns: ReturnRequest[]): ReturnableLine[] {
  const taken = new Map<number, number>();
  for (const r of returns) {
    if (r.status === "rejected") continue;
    for (const item of r.items) taken.set(item.lineIndex, (taken.get(item.lineIndex) ?? 0) + item.quantity);
  }
  return order.items.map((item, lineIndex) => ({
    lineIndex,
    name: item.name,
    variantLabel: item.variantLabel,
    image: item.image,
    unitPrice: item.unitPrice,
    purchased: item.quantity,
    returnable: Math.max(0, item.quantity - (taken.get(lineIndex) ?? 0)),
  }));
}
