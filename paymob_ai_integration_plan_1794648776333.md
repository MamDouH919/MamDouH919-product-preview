# Paymob Integration Plan

> Generated: 2026-11-14T09:32:56.331Z | App v3.0.0

## Prompt — Copy and Paste This Into Your AI Agent

You are a Paymob integration assistant. I am a Developer / Technical Integrator integrating Paymob payments for Egypt using Node.js / TypeScript / NestJS (TypeScript) • Unified Checkout (Redirection) with the following optional features: Digital Wallets, BNPL & Installments, Kiosk (cash), Manage Payments (Refund/Void/Capture).

I have an integration roadmap below with 6 stages. My current focus is: "Paymob account setup".

Please help me complete this integration step by step. For every unchecked task, tell me:
1. Exactly what to do and in which order.
2. Which Paymob Dashboard settings, API keys, or credentials are involved.
3. What code or configuration I need to add — tailored to my platform and stack above.
4. How to verify the task is done correctly (test, log, or dashboard check).

Rules you must follow:
- Only suggest payment methods and features documented for Egypt. Do not assume features are available if they are not listed in this file.
- Use the official Paymob doc links already included in the roadmap below — do not invent URLs.
- Respect the roadmap order unless a dependency forces a different sequence.
- Start with the earliest stage that still has unchecked tasks.

---

## Configuration
- Role: Developer / Technical Integrator
- Country: Egypt
- Integration Summary: Node.js / TypeScript / NestJS (TypeScript) • Unified Checkout (Redirection)
- Account Readiness: Missing credentials or Integration IDs
- Payment Flow: One-time checkout
- Launch Target: Sandbox only
- Dashboard Login: https://eg.dashboard.paymob.com/login
- Paymob Docs: https://developers.paymob.com/paymob-docs
- Backend: Node.js / TypeScript
- Backend Framework: NestJS (TypeScript)
- Checkout Experience: Unified Checkout (Redirection)
- Selected Features: Digital Wallets, BNPL & Installments, Kiosk (cash), Manage Payments (Refund/Void/Capture)

## Dependencies and Setup

- Selected backend framework: NestJS (TypeScript)
- Install/setup: `npm install @nestjs/axios axios`
- Create Intention API: https://developers.paymob.com/paymob-docs/intention-apis/create-intention

### Minimal starter

Reference: https://developers.paymob.com/paymob-docs/intention-apis/create-intention

```javascript
import axios from 'axios';

const { data } = await axios.post(process.env.PAYMOB_INTENTION_URL, intentionPayload, {
  headers: { Authorization: `Token ${process.env.PAYMOB_SECRET_KEY}` },
});
```

## Progress Snapshot
- Current Step: 1 of 6
- Completed Stages: 0 of 6
- Overall Progress: 0%
- Current Focus: Step 1 - Paymob account setup

## Roadmap
### Step 1: Paymob account setup
Progress: 0/3 tasks completed (0%)

- [ ] Sign in or create your Paymob account Sign in
- [ ] Retrieve Secret Key, Public Key, API Key, HMAC Secret, and Integration IDs API Keys [Documentation](https://developers.paymob.com/paymob-docs/need-help/faq/getting-integration-credentials)
- [ ] Create or sync payment integrations for the methods you will launch Payment Integrations [Documentation](https://developers.paymob.com/paymob-docs/payments-and-features/payment-methods/cards-all-regions)

### Step 2: Your website/app setup
Progress: 0/5 tasks completed (0%)

- [ ] [Review the API integration flow: create intention, launch checkout, receive callbacks, verify HMAC](https://developers.paymob.com/paymob-docs/integration-paths/apis)
- [ ] [Build the Create Intention endpoint with NestJS (TypeScript)](https://developers.paymob.com/paymob-docs/intention-apis/create-intention)Developer setupInstallation: npm install @nestjs/axios axios Try it in Code Lab
- [ ] [Implement Unified Checkout (redirection)](https://developers.paymob.com/paymob-docs/checkout-experiences/unified-checkout-redirection) Try it in Code Lab
- [ ] Prepare a public HTTPS webhook URL — use [hooks.paymob.com](https://hooks.paymob.com) for sandbox testing before deploying a real endpoint [Webhook docs](https://developers.paymob.com/paymob-docs/webhook-callbacks-and-hmac/overview) Webhook handler
- [ ] Verify HMAC SHA-512 on every callback before trusting payment status. Sort the 20 standard fields lexicographically, concatenate values, hash with your HMAC secret, compare to the hmac field.
              Source of truth: Treat the backend Transaction Processed POST callback as authoritative — not the SDK response GET, not the browser redirect.
              
                What to watch for
                
                  Field spelling: error_occured (one 'r' — that's the canonical API field name, do not "correct" it).
                  POST vs GET key names: POST callback uses obj.id and order.id; GET redirect uses id and order_id.
                  Test before deploying: use [hooks.paymob.com](https://hooks.paymob.com/) to capture sandbox callbacks.
                  Idempotency: dedupe handlers by transaction id — Paymob may retry.
                
                [HMAC docs](https://developers.paymob.com/paymob-docs/webhook-callbacks-and-hmac/hmac)
              
              Debug HMAC in Code Lab

### Step 3: Test payment
Progress: 0/4 tasks completed (0%)

- [ ] Make a sandbox payment using test credentials — run success, decline, and 3DS card flows 💳 Run it here [Documentation](https://developers.paymob.com/paymob-docs/need-help/faq/test-credentials)
- [ ] Open Transactions in your dashboard and confirm your test payment result Transactions [Documentation](https://developers.paymob.com/paymob-docs/transaction-inquiry-apis/by-transaction-id)
- [ ] Refund or void that test payment from your dashboard, so you know how before real customers ask Open transactions [Documentation](https://developers.paymob.com/paymob-docs/payments-and-features/managing-payments/refund)
- [ ] Verify checkout on your own store: pay once from it and let the wizard confirm the payment, the callback and the order Verify my checkout

### Step 4: Optional features
Progress: 0/10 tasks completed (0%)

- [ ] [Apple Pay configuration](https://developers.paymob.com/paymob-docs/payments-and-features/payment-methods/apple-pay-all-regions)
- [ ] [Local wallet requirements (Vodafone Cash, Orange Cash, e&amp; money, We Pay, and bank wallets)](https://developers.paymob.com/paymob-docs/payments-and-features/payment-methods/mobile-wallets-egy-ksa)
- [ ] Google Pay is not supported in Egypt; do not plan it unless Paymob confirms a change.
- [ ] [BNPL overview (valU, Souhoola, Aman, and Sympl)](https://developers.paymob.com/paymob-docs/payments-and-features/payment-methods/bnpls-egy-ksa-uae)
- [ ] [Bank installments setup (Egypt only)](https://developers.paymob.com/paymob-docs/payments-and-features/payment-methods/bank-installments-egy)
- [ ] [Kiosk cash payments (Egypt only; refunds are not supported)](https://developers.paymob.com/paymob-docs/payments-and-features/payment-methods/kiosk-egy)
- [ ] Customers generate a bill reference and pay cash at a supported kiosk. Do not offer dashboard or API refunds for kiosk transactions.
- [ ] [Implement refund flow and partial refund handling](https://developers.paymob.com/paymob-docs/payments-and-features/managing-payments/refund)
- [ ] [Document void rules for same-day unsettled card transactions](https://developers.paymob.com/paymob-docs/payments-and-features/managing-payments/void)
- [ ] [Document capture rules for Auth/Capture transactions](https://developers.paymob.com/paymob-docs/payments-and-features/managing-payments/capture)

### Step 5: Go Live
Progress: 0/4 tasks completed (0%)

- [ ] Start early — Paymob's review runs while you test. Add a working phone number and your website for the Go Live support email Contact details
- [ ] Paymob reviews your account and documents. Keep testing meanwhile — you can switch to live once your account is approved Check approval
- [ ] After Paymob approves your account, switch to live keys, live Integration IDs and a live callback URL Switch to live
- [ ] Launch: make one small real payment and refund it Check live transactions

### Step 6: After launch
Progress: 0/2 tasks completed (0%)

- [ ] Watch the first 48 hours of live payments: failed payments, callbacks reaching your store, and customer questions Live transactions
- [ ] Check your settlements and payouts so you know when money reaches your bank Payouts
