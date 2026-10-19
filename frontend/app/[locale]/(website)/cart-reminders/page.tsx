import type { Metadata } from "next"
import CartRemindersOptOutClient from "./_CartRemindersOptOutClient"

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default function CartRemindersOptOutPage() {
  return <CartRemindersOptOutClient />
}
