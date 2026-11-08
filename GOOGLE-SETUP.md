# Google Search Console & Merchant Center setup

One pass per store (tenant), after it is deployed on its own domain. Examples use
`ranosh.novaslash.com`; replace it with the store's host.

What the code already serves for every store:

| URL | What it is |
|---|---|
| `/sitemap.xml` | Every public page, Arabic first, with English as an hreflang alternate |
| `/robots.txt` | Keeps admin, account, cart and checkout out of search; points to the sitemap |
| `/feeds/google-ar.xml`, `/feeds/google-en.xml` | Product feeds for Merchant Center, one per language |
| `/ar/shipping-policy`, `/ar/return-policy` | Policy pages, once seeded (step 1) |

---

## 1. Fill in the store first

Google shows what the store says about itself, so do this before submitting anything.

**Dashboard → Settings**
- Phone, WhatsApp, email, address, social media links. These go into the store's structured data and the policy pages.
- Return window (days), and the delivery fee: one flat fee, or the price list by area.
- Currency and country (super admin).

**Dashboard → Categories**: set *Google product category* on each one. Use an id or path from
[Google's product taxonomy](https://support.google.com/merchants/answer/6324436), e.g. `5605` or
`Arts & Entertainment > Party & Celebration`.

**Dashboard → Products**: every product needs a photo and a price, or the feed leaves it out.
Where they apply, fill in *Price before discount* (shows as a sale), *Brand* (empty = the store's
name) and *Barcode (GTIN)*. Leave the barcode empty for handmade products. Give variants a colour
and/or size so Google groups them.

**Policy pages**, from the settings above:

```bash
cd backend
npm run seed:policies -- ranosh.novaslash.com            # creates them if missing
npm run seed:policies -- ranosh.novaslash.com --reset    # rewrite them after changing the settings
```

They are ordinary pages after that: read them in **Dashboard → Pages** and adjust the wording,
especially the delivery times (default 2–5 business days) and refund time (default 7–14 days).
They appear in the footer, under *Add to cart* and at checkout.

---

## 2. Google Search Console

1. Go to <https://search.google.com/search-console> → **Add property**.
   - **Domain** property (recommended) if you control DNS: add the TXT record it gives you.
   - Otherwise **URL prefix** `https://ranosh.novaslash.com/` → *HTML tag*. Copy the `content`
     value into `contentSiteVerify` in `frontend/lib/tenants/<store>.ts`, deploy, then press
     *Verify*.
2. **Sitemaps** → submit `https://ranosh.novaslash.com/sitemap.xml`.
3. **URL Inspection** → enter the home page and one product page → *Request indexing*.
4. A few days later, check **Pages** (what is indexed and why not) and
   **Enhancements → Products / Merchant listings / Breadcrumbs** for structured-data errors.

---

## 3. Google Merchant Center

1. Go to <https://merchants.google.com>, create an account for the store, and add the website
   `https://ranosh.novaslash.com`. Verify and claim it. The quickest way is linking the Search
   Console property from step 2 (**Settings → Linked accounts**).
2. **Business info**: name, address, phone and customer service contact. Use the same values as
   the dashboard settings.
3. **Shipping** (*Settings → Shipping and returns*): add a service for the store's country.
   - Flat fee in the dashboard → the same fee here. The feed sends it with each product too.
   - Fee by area → set a rate table here, or the highest fee, because the feed can't send
     per-area prices.
   - Delivery time: the same as the shipping policy page (e.g. 1–2 days handling, 2–5 transit).
4. **Returns** (same page): return window = the dashboard's return window. Policy URL =
   `https://ranosh.novaslash.com/ar/return-policy`.
5. **Products → Add products → Add products from a file → Scheduled fetch**, once per language:

   | Feed | URL | Country | Language |
   |---|---|---|---|
   | Arabic | `https://ranosh.novaslash.com/feeds/google-ar.xml` | Egypt | Arabic |
   | English | `https://ranosh.novaslash.com/feeds/google-en.xml` | Egypt | English |

   Fetch daily. The feed always reflects current prices and stock. Start with Arabic; add
   English only if you also want to show in English results.
6. Make sure **free listings** are on (*Growth → Manage programs*).
7. After the first fetch, check **Products → Diagnostics**. Common items:
   - *Price mismatch*: the product page and the feed disagree. They share one source in the
     code, so this usually means a price changed between the fetch and the crawl, and it clears
     on the next fetch.
   - *Missing GTIN*: expected for handmade products (the feed sends `identifier_exists=no`). Add a
     barcode only for branded goods that have one.
   - *Image too small / missing*: upload larger photos (at least 500×500 is safe).

> A store on the **catalog** plan (no online checkout, orders on WhatsApp) can be refused by
> Merchant Center, which expects shoppers to be able to buy on the site.

---

## 4. Check after each deploy

- <https://search.google.com/test/rich-results> with a product page URL: *Product snippets* and
  *Merchant listings* should be valid, with price, stock, shipping and returns.
- Open `/feeds/google-ar.xml` in a browser. It should list the products. A **503** means the
  backend was unreachable or the store's currency isn't set; Merchant Center keeps the last good
  fetch rather than delisting everything.
- `/sitemap.xml` lists the products and categories.

## 5. When things change

| Change | Also do |
|---|---|
| Return window or delivery fee in Settings | `seed:policies -- <host> --reset` (or edit the pages), and update Merchant Center's shipping / returns |
| New store | Steps 1–3 for its domain, and `contentSiteVerify` in its tenant file |
| New product category | Set its *Google product category* |
