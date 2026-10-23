import type { HelpGuideSource } from "../guide";

const en: HelpGuideSource = {
  start: {
    label: "Getting started",
    summary: "How the system thinks, the right setup order, and where everything lives in the menu.",
    sections: [
      {
        title: "The system in a few lines",
        blocks: [
          {
            type: "p",
            unless: "orders",
            text: "Your store is a showcase: visitors browse your products and categories on the website and ask about them on **WhatsApp** — nothing is ordered or paid for online. The dashboard is where you keep the catalogue and the website up to date.",
          },
          {
            type: "list",
            unless: "orders",
            title: "Worth knowing from day one",
            items: [
              "A product shows on the website only while it's **Active**. Switch it off to hide it without deleting it.",
              "Every product has a **WhatsApp** button, so keep the WhatsApp number in **Settings → General** up to date — it's how visitors reach you.",
              "To show products without prices, turn off **Show prices** in **Settings → General**.",
              "Online orders, stock and accounting aren't part of your plan. Contact us if you'd like to add them.",
            ],
          },
          {
            type: "p",
            requires: ["finance"],
            text: "The dashboard isn't just a list of orders — it keeps full accounting books. Every movement of money or goods (a collection, refund, purchase, expense, courier settlement or transfer) is posted to the books automatically and shows up straight away in **Money accounts** balances and in **Reports**.",
          },
          {
            type: "list",
            requires: ["orders", "finance"],
            title: "Rules worth knowing from day one",
            items: [
              "Money records are **never edited** once saved. A mistake is fixed with **Void** or **Reverse**, which posts a new entry cancelling the old one; the original stays on record with your reason.",
              "Revenue is counted **on the day an order is delivered**, not the day it was placed. An order that hasn't been delivered isn't revenue yet.",
              "Orders delivered before the **books started** aren't in the accounts: their payment shows **Not tracked** and they can't be refunded in the system.",
              "Days closed on the **Books and closing** page can't take any new records.",
            ],
          },
        ],
      },
      {
        title: "Suggested setup order",
        blocks: [
          {
            type: "steps",
            unless: "orders",
            items: [
              "**Settings → General**: store details, logo and colours, and your phone and **WhatsApp** numbers. Decide here whether to **Show prices**.",
              "**Settings → Email**: so messages from the website's contact form reach you.",
              "**Products & categories**: create the categories first, then add products by hand or import them all at once from a CSV file (see the Import tab).",
              "**Website content**: banners, home-page sections, and pages such as About us.",
            ],
          },
          {
            type: "steps",
            requires: ["orders", "inventory", "finance"],
            items: [
              "**Settings → General**: store details, currency and the **Return window (days)**.",
              "**Settings → Email**: so customers receive order emails and password-reset links.",
              "**Delivery → Price list**: a price for each governorate or area (0 = free delivery).",
              "**Delivery → Couriers**: add your own couriers or delivery companies.",
              "**Finance → Money accounts**: create your cash box, bank account and wallets, and pick the default one.",
              "**Products**: add products by hand, or import them all at once from a CSV file (see the Import tab).",
              "**Inventory**: set the cost of stock you already had before starting (**Set cost**).",
              "**Stock & purchasing → Suppliers**: add suppliers, then record all new stock as a **Purchase**.",
            ],
          },
        ],
      },
      {
        title: "The side menu: where is everything?",
        blocks: [
          {
            type: "list",
            unless: "orders",
            items: [
              "**Products & categories**: products (including CSV import/export), categories and sub-categories.",
              "**Customers & messages**: reviews, contact messages and subscribers.",
              "**Website content**: pages, banners and sections.",
              "**Settings**: general, email, and the **Activity log** (every change made in the dashboard and who made it, kept for a year).",
            ],
          },
          {
            type: "list",
            requires: ["orders", "inventory", "finance"],
            items: [
              "**Sales**: orders, returns, refunds and coupons.",
              "**Products & categories**: products (including CSV import/export), categories and sub-categories.",
              "**Stock & purchasing**: inventory and its movements, purchases from suppliers, and suppliers.",
              "**Delivery**: couriers (including settling cash with them) and the delivery price list.",
              "**Customers & messages**: customers, reviews, contact messages and subscribers.",
              "**Finance**: reports, money accounts, expenses, and books and closing.",
              "**Website content**: pages, banners and sections.",
              "**Settings**: general, email, and the **Activity log** (every change made in the dashboard and who made it, kept for a year).",
            ],
          },
          {
            type: "tip",
            text: "At the top of every page, next to the page path, there's a **question mark (?)** icon. If something on the page you're on isn't clear, click it to jump straight to the part of this guide that explains it.",
          },
        ],
      },
    ],
  },

  orders: {
    requires: ["orders"],
    label: "Orders & collection",
    summary: "An order's journey from the moment it's placed until its cash is in the till.",
    sections: [
      {
        title: "An order's journey",
        path: "/admin/orders",
        blocks: [
          { type: "flow", items: ["Pending", "Confirmed", "Shipped", "Delivered"] },
          {
            type: "steps",
            items: [
              "Open the order from **Sales → Orders**.",
              "Check the items and address, then click **Confirm order**.",
              "When it leaves with the courier, click **Mark as shipped** — the note can hold the courier's name or tracking number.",
              "When the customer receives it, click **Mark as delivered**. From that moment the order counts as **revenue**, and the **Payment** section opens for recording the collection.",
            ],
          },
          {
            type: "warning",
            text: "Cancelling an order (before delivery) puts its items back in stock automatically. After delivery there's no cancelling — what comes back is a **Return**.",
          },
        ],
      },
      {
        title: "Recording a collection (cash on delivery)",
        path: "/admin/orders",
        blocks: [
          {
            type: "steps",
            items: [
              "Open a **Delivered** order and scroll to **Payment**.",
              "Enter the **Amount collected** — all of it or part of it.",
              "Choose **Collected by**: **Store staff** if the cash actually reached the store, then pick the money account it went into. Or **Courier (to hand over)** if the courier is still holding the cash, then pick the courier.",
              "Click **Record collection**.",
            ],
          },
          {
            type: "tip",
            text: "When the courier collects, the cash doesn't reach your till yet — it's recorded as cash **held by the courier** until you **Settle** with them on the Couriers page (see the Accounts tab).",
          },
        ],
      },
      {
        title: "Payment statuses",
        blocks: [
          {
            type: "list",
            items: [
              "**Unpaid**: delivered, nothing collected yet.",
              "**Partly paid**: some collected; the rest shows under **Still owed**.",
              "**Paid**: collected in full.",
              "**Partly refunded / Refunded**: some or all of the money went back to the customer.",
              "**Written off**: the rest was booked as uncollectible.",
              "**Not tracked**: delivered before the books started, so it isn't in the accounts.",
            ],
          },
        ],
      },
      {
        title: "Fixing a wrong collection, or writing off a balance",
        blocks: [
          {
            type: "p",
            text: "If a collection has the wrong amount or account, click **Void** next to it and give a reason. The amount goes back to what the customer owes, and the collection stays on record marked **Voided**. Then record the correct one.",
          },
          {
            type: "p",
            text: "If the customer will never pay the rest (they refused or disappeared), use **Write off balance**. The amount is booked as uncollectible and shows among the expenses in Profit and loss.",
          },
          { type: "warning", text: "Write off only when you're sure the money won't come — it isn't a substitute for recording a collection." },
        ],
      },
    ],
  },

  returns: {
    requires: ["orders", "finance"],
    label: "Returns & refunds",
    summary: "How to take a return, put goods back in stock, and give the money back correctly.",
    sections: [
      {
        title: "Return vs refund",
        blocks: [
          {
            type: "list",
            items: [
              "A **return** is goods coming back from the customer (Sales → Returns).",
              "A **refund** is money going back to the customer (Sales → Refunds).",
              "A return is usually followed by a refund. But you can also **refund without a return** — compensation for a late delivery or a goodwill gesture — with no goods coming back.",
            ],
          },
          {
            type: "warning",
            text: "Goods only go **back in stock**, and money only reaches **the books**, when the refund is **Paid out**. Approving a return on its own moves nothing.",
          },
        ],
      },
      {
        title: "Where returns come from",
        blocks: [
          {
            type: "list",
            items: [
              "**The customer**: from their account on the website, within the **Return window** set in **Settings → General** (0 turns customer requests off). You get an email alert if it's switched on.",
              "**The store**: for a return taken by phone or in store, open the order (it must be **Delivered**) and click **Create return** in its Returns section. These start **Approved**.",
            ],
          },
          { type: "flow", title: "Return statuses", items: ["Requested", "Approved", "Refunded"] },
          { type: "p", text: "It can be **Rejected** at any point before it's refunded." },
        ],
      },
      {
        title: "Handling a return, start to finish",
        path: "/admin/returns",
        blocks: [
          {
            type: "steps",
            items: [
              "Open **Sales → Returns** and click a return with status **Requested**.",
              "Check the items, quantities, **Reason** and the customer's note.",
              "Click **Approve** (optionally with a note to the customer), or **Reject** if it isn't accepted.",
              "Click **Request refund**.",
              "Choose the **Reason**, and under **Put back in stock** tick only the sellable items. Untick anything damaged so it isn't counted in stock (with the reason \"Damaged\" they start unticked).",
              "Check the **Product refund**: the suggestion is the item prices less their share of the order discount, and it can't exceed the maximum shown under it.",
              "Check the **Delivery-fee refund**: the suggestion follows the store's policy (shown under the field).",
              "Choose how it's **Paid back** (see the next section).",
              "Click **Request refund**. Within the automatic limit it's approved at once; otherwise it waits for an approver.",
              "Once approved, click **Pay out** — from the refund card on the same return page or from the **Refunds** page. Only now does the money leave, the goods go back in stock, and the return become **Refunded**.",
            ],
          },
          { type: "flow", title: "Refund statuses", items: ["Waiting for approval", "Approved", "Paid out"] },
        ],
      },
      {
        title: "Ways to give the money back",
        blocks: [
          {
            type: "list",
            items: [
              "**Cash from the store**: paid from the money account you pick under **Paid from**. At most what was actually collected from the customer, less what was already refunded.",
              "**Cash by the courier**: the courier pays the customer from the cash they hold, so it comes off what they hand over at settlement.",
              "**Credit against what is owed**: if the customer hasn't paid the whole order, reduce what they owe instead of handing over cash. At most what they still owe.",
            ],
          },
          { type: "tip", text: "Each method in the list shows the most it can pay back; a method with nothing left is disabled." },
          {
            type: "example",
            title: "Example",
            lines: [
              "An order of 900 + 50 delivery = 950, all paid to the courier.",
              "One item priced 300 comes back as the wrong item; the order had a 10% discount.",
              "Suggested product refund = 300 − 30 = 270.",
              "Delivery: the policy is \"when everything comes back and it was the store's fault\" — not everything came back, so 0.",
              "Total 270 is above the automatic limit (200 by default), so it waits for an approver. Once approved, Pay out.",
            ],
          },
        ],
      },
      {
        title: "Approval rules and delivery-fee policy",
        path: "/admin/settings",
        blocks: [
          {
            type: "p",
            text: "In **Settings → General → Refund rules** (only the store's super admin can change these, and every change is recorded):",
          },
          {
            type: "list",
            items: [
              "**Approve automatically up to**: refunds below this are approved as soon as they're asked for (200 by default).",
              "**One approver is enough up to**: above this, someone **other than the person who asked** must approve (2,000 by default).",
              "**Delivery fee is refunded**: never — whenever everything comes back — when everything comes back and it was the store's fault (default) — or when the approver decides.",
            ],
          },
          {
            type: "warning",
            text: "Giving back more of the delivery fee than the policy allows sends the refund to an approver and needs a **Note** explaining why.",
          },
        ],
      },
      {
        title: "Refund without a return",
        path: "/admin/orders",
        blocks: [
          {
            type: "p",
            text: "Open the order and click **Refund** on its **Refunds** card. Pick the reason (goodwill, late delivery, …) and the amount. No goods go back to stock. Approval and pay-out work the same way.",
          },
        ],
      },
      {
        title: "Made a mistake? Reversing a refund",
        path: "/admin/refunds",
        blocks: [
          {
            type: "list",
            items: [
              "Before it's paid out: **Reject** it and request a correct one.",
              "After it's paid out: **Reverse** it with a reason. A reversing entry dated today is posted, and the return goes back to **Approved** so you can request a new refund.",
              "Goods already put back in stock **stay there** after a reversal — if they shouldn't have, correct them with a **Stock take** on the Inventory page.",
              "A refund paid by a courier that has already been settled **can't be reversed**.",
            ],
          },
          {
            type: "warning",
            text: "Orders delivered before the books started can't be refunded in the system — record those refunds outside it.",
          },
        ],
      },
    ],
  },

  accounts: {
    requires: ["finance"],
    label: "Accounts",
    summary: "Cash box, bank and wallets, settling with couriers, and expenses.",
    sections: [
      {
        title: "Money accounts",
        path: "/admin/money-accounts",
        blocks: [
          {
            type: "p",
            text: "A money account is any place the store's money actually sits. There are three types: **Cash box**, **Bank account** and **Mobile wallet**. Each balance **comes from the books** — you never type it in; it's the sum of everything that moved through that account.",
          },
          {
            type: "steps",
            title: "Creating an account",
            items: [
              "Click **New money account**.",
              "Enter a name (e.g. Shop till, Main bank, Store wallet) and pick the type. **The type can't be changed later.**",
              "Click **Make default** on the account most money goes into — it's used automatically whenever a record doesn't name an account.",
            ],
          },
          {
            type: "tip",
            text: "An account money has moved through can't be deleted — **Deactivate** it instead. The default account can't be deactivated.",
          },
        ],
      },
      {
        title: "What moves money in and out?",
        blocks: [
          {
            type: "list",
            title: "Money in",
            items: [
              "A customer collection by **Store staff** (into the account you chose).",
              "A **courier settlement** — the cash they hand over (into **Paid into**).",
              "A transfer from another account.",
            ],
          },
          {
            type: "list",
            title: "Money out",
            items: [
              "A refund as **Cash from the store**.",
              "An **expense** (from **Paid from**).",
              "A **supplier payment**.",
              "A transfer to another account.",
            ],
          },
        ],
      },
      {
        title: "Transferring between accounts",
        path: "/admin/money-accounts",
        blocks: [
          {
            type: "steps",
            items: [
              "Click **Transfer money** (you need at least two active accounts).",
              "Pick **From** and **To**, and enter the amount — no more than the source account holds.",
              "Add a note (e.g. weekly deposit to the bank) and click **Transfer**.",
            ],
          },
          { type: "tip", text: "A transfer is neither income nor an expense — the store's total money stays the same, only where it sits changes." },
        ],
      },
      {
        title: "Settling cash with a courier",
        path: "/admin/couriers",
        blocks: [
          {
            type: "p",
            text: "Every collection recorded as **Courier** adds to what that courier holds. A refund the courier paid a customer from that cash comes off it. When the courier comes back and hands the cash over, you **Settle**.",
          },
          {
            type: "steps",
            items: [
              "In **Delivery → Couriers**, click **Settle** next to the courier.",
              "You'll see what they collected and from how many orders, refunds they paid to customers, and what they **Hold** (= collected − refunds).",
              "Enter the **Courier's fee** if they keep their fee from that cash — it's booked as a delivery cost.",
              "Under **Cash handed over** enter what they actually gave you. The expected amount is shown under the field (= held − fee).",
              "Choose the account under **Paid into**.",
              "If what they hand over differs from what's expected (short or over), you must give a **Reason**.",
              "Click **Settle**.",
            ],
          },
          {
            type: "example",
            title: "Example",
            lines: [
              "The courier collected 3 orders worth 1,650.",
              "They paid a customer a 200 refund → they hold 1,450.",
              "Their fee is 150 → they should hand over 1,300.",
              "They hand over 1,300 → it goes into the cash box, and the 150 is booked as a delivery cost.",
            ],
          },
          {
            type: "warning",
            text: "If the courier's fee is more than the cash they hold, the settlement won't go through. Enter a fee up to what they hold and record the rest as an **Expense** under \"Delivery and courier costs\".",
          },
        ],
      },
      {
        title: "Expenses",
        path: "/admin/expenses",
        blocks: [
          {
            type: "steps",
            items: [
              "Click **New expense**.",
              "Pick the **Category**: delivery costs, rent, salaries, marketing, packaging, bank fees, utilities, or other operating expenses.",
              "Enter the amount, date and description, plus the receipt or invoice number if there is one.",
              "Choose **Paid from** — the account the money left — and click **Save**.",
            ],
          },
          {
            type: "p",
            text: "Expenses are **never edited**. If one is wrong, click **Reverse** and give a reason: a reversing entry dated today cancels it, and the original stays in its period marked **Reversed**. Then record the correct one.",
          },
          { type: "tip", text: "Above the table you'll see the total for each category in the chosen period — handy for spotting where the money goes." },
        ],
      },
    ],
  },

  purchases: {
    requires: ["inventory", "finance"],
    label: "Purchases & suppliers",
    summary: "Bringing in new stock from a supplier at its cost, paying them, and sending goods back.",
    sections: [
      {
        title: "Why record stock as a purchase?",
        blocks: [
          {
            type: "p",
            text: "A purchase is the right way to bring new stock in. Recording one does three things together: adds the units to stock, works out the **Unit cost** (a moving average), and records what you owe the supplier. Without that cost, profit reports won't be accurate.",
          },
        ],
      },
      {
        title: "Adding a supplier",
        path: "/admin/suppliers",
        blocks: [
          {
            type: "steps",
            items: [
              "In **Stock & purchasing → Suppliers**, click **New supplier**.",
              "Enter the name, phone, tax number (optional) and any notes.",
              "The **Owed** column shows what you owe each supplier right now.",
            ],
          },
        ],
      },
      {
        title: "Recording a purchase",
        path: "/admin/purchases",
        blocks: [
          {
            type: "steps",
            items: [
              "In **Purchases**, click **New purchase**.",
              "Pick the supplier, and enter the **Supplier invoice no.** and **Received on** date.",
              "For each product click **Add line**: pick the product (or its size/colour), the quantity and the **Unit cost**. Products that don't track stock can't be picked.",
              "Under **Freight and other costs** enter shipping, customs and the like. It's spread over the lines by value, so it becomes part of what the stock cost.",
              "Click **Save draft**. A draft **moves nothing** — edit it as much as you like.",
              "When the goods actually arrive, open the purchase and click **Post — goods received**.",
            ],
          },
          { type: "flow", items: ["Draft", "Posted"] },
          {
            type: "warning",
            text: "Once posted, the goods enter stock at their cost and the amount is owed to the supplier from the received date — and the purchase **can't be edited or cancelled**. Corrections are made with **Return to supplier**.",
          },
          {
            type: "example",
            title: "How freight is spread",
            lines: [
              "Line 1: 10 units × 100 = 1,000 — Line 2: 5 units × 200 = 1,000.",
              "Freight 200 → each line is half the value, so each takes 100.",
              "Real unit cost: line 1 = 110, line 2 = 220.",
            ],
          },
        ],
      },
      {
        title: "Paying a supplier",
        path: "/admin/suppliers",
        blocks: [
          {
            type: "steps",
            items: [
              "In **Suppliers** (or on a purchase page) click **Pay**.",
              "The amount owed now is shown. Enter what you're paying — part of it is fine.",
              "Pick the account the money left and save.",
            ],
          },
          { type: "tip", text: "A payment settles the **oldest purchases first**, automatically." },
        ],
      },
      {
        title: "Returning goods to a supplier",
        path: "/admin/purchases",
        blocks: [
          {
            type: "steps",
            items: [
              "Open a posted purchase and click **Return to supplier**.",
              "For each line enter how many units go back (the maximum is shown next to it).",
              "Confirm.",
            ],
          },
          {
            type: "p",
            text: "The units leave stock at what they were bought for, and that comes off what you owe the supplier. Only units still on the shelf can go back.",
          },
        ],
      },
    ],
  },

  inventory: {
    requires: ["inventory"],
    label: "Inventory",
    summary: "Quantities and cost, stock takes, and manual adjustments.",
    sections: [
      {
        title: "Reading the Inventory page",
        path: "/admin/inventory",
        blocks: [
          {
            type: "list",
            items: [
              "**Tracked items / Total units**: how many products track stock, and how many units in all.",
              "**Stock value at cost**: quantity × unit cost — the money tied up in stock.",
              "**Stock value at selling price**: what everything would bring in at today's prices.",
              "**Items with no cost**: stock you had before the books started with no cost set yet — left out of the value.",
              "**Low stock / Out of stock**: products that reached your threshold or ran out.",
            ],
          },
        ],
      },
      {
        title: "Setting opening cost",
        path: "/admin/inventory",
        blocks: [
          {
            type: "p",
            text: "Stock that was on the shelf before the books started has no cost. Such products show a **Set cost** button — enter what one unit really cost you. It's set **once**; after that, costs come from purchases.",
          },
          { type: "warning", text: "Selling a product before its cost is set leaves its margin incomplete in Sales by product." },
        ],
      },
      {
        title: "Adjusting stock by hand",
        path: "/admin/inventory",
        blocks: [
          { type: "p", text: "Click the **Adjust stock** icon next to a product. There are two ways:" },
          {
            type: "list",
            items: [
              "**Record movement**: pick the **Movement type** (damage, adjustment add, adjustment remove…) and enter the quantity as a positive number — the type decides the direction. Add a reference and reason.",
              "**Stock take**: enter the **Counted quantity** you actually counted; the system works out and records the difference.",
            ],
          },
          {
            type: "tip",
            text: "Don't use \"Adjustment (add)\" for stock from a supplier — record it as a **Purchase** so its cost and what you owe are recorded.",
          },
        ],
      },
      {
        title: "Movement history",
        path: "/admin/inventory/movements",
        blocks: [
          {
            type: "p",
            text: "The **Transactions** icon next to a product, or the **Stock movements** button at the top, shows every movement: sale, order cancelled, return, purchase, returned to supplier, stock take, damage — with the balance after each and who made it.",
          },
        ],
      },
      {
        title: "Stock settings on a product",
        path: "/admin/products",
        blocks: [
          {
            type: "list",
            items: [
              "**Track stock**: turn off for products that never run out (made to order, services).",
              "**Opening stock**: the quantity when the product is created. Later changes are made on the Inventory page.",
              "**Low stock at**: the product shows as low once its quantity reaches this number.",
              "**Allow backorder**: customers can keep ordering at 0.",
              "A product with sizes or colours has stock set for each variant separately.",
            ],
          },
        ],
      },
    ],
  },

  import: {
    label: "Import",
    summary: "Importing and updating products from a CSV file, and importing the database.",
    sections: [
      {
        title: "Importing products from CSV",
        path: "/admin/products",
        blocks: [
          {
            type: "p",
            text: "Add many products at once, or change the details and prices of existing ones, from an Excel or Google Sheets file instead of opening each product.",
          },
          {
            type: "steps",
            items: [
              "On **Products**, click **Export CSV** first — it gives you a file with the right columns, holding your current products.",
              { text: "Open it in Excel or Google Sheets and edit: change prices or quantities, or add rows for new products.", requires: ["inventory"] },
              { text: "Open it in Excel or Google Sheets and edit: change names or prices, or add rows for new products.", unless: "inventory" },
              "Save it as **CSV UTF-8** (so Arabic text stays intact).",
              "Back on Products, click **Import CSV**, then **Choose CSV file**.",
              "A **preview** appears: each row is marked **New**, **Update**, **Unchanged** or **Error** with its line number. At this point **nothing has changed yet**.",
              "If there are no errors, click **Apply changes**.",
            ],
          },
        ],
      },
      {
        title: "How the file is read",
        blocks: [
          {
            type: "list",
            items: [
              "Each row is matched to an existing product by **product_id** first, then by **slug**. A row that matches nothing **creates a new product**.",
              "**An empty cell leaves that field as it is** — to change only the price, leave the other columns empty.",
              { text: "Quantity changes are recorded in stock movements as a **Stock take**, so you can trace them later.", requires: ["inventory"] },
            ],
          },
          {
            type: "warning",
            text: "Don't rename the column headers (first row), and don't clear **product_id** for existing products — otherwise they're created again as new products instead of being updated.",
          },
        ],
      },
      {
        title: "If there are errors",
        blocks: [
          {
            type: "faq",
            items: [
              { q: "The preview has \"Error\" rows.", a: "Fix them in the file (each error shows its line number) and upload again. Nothing has been changed." },
              {
                q: "A message says the import stopped partway.",
                a: "Products above the one marked with the error were saved; the rest weren't. Fix the error and upload again — the saved rows will show as Unchanged.",
              },
              { q: "A message says nothing differs.", a: "The file matches your catalogue exactly; there's nothing to change." },
            ],
          },
          {
            type: "tip",
            requires: ["inventory", "finance"],
            text: "CSV is great for adding products, changing prices and stock takes. But stock arriving from a supplier should be recorded as a **Purchase**, so its cost and what you owe are recorded.",
          },
        ],
      },
      {
        title: "Importing the database (super admin only)",
        path: "/admin/database",
        blocks: [
          {
            type: "p",
            text: "On the **Database** page you can **export** all of the store's data to a file, or **import** a file exported earlier **from this same store**.",
          },
          {
            type: "steps",
            items: [
              "Click **Choose File** and pick the export file.",
              "Click **Check file** — it lists what will be imported and how many records in each part, or why it can't be.",
              "Enter your password and type the site name as asked, to confirm.",
              "Click **Import now**.",
            ],
          },
          {
            type: "warning",
            text: "Importing is only allowed while the store has **no orders, returns or stock history** — i.e. a fresh store. And an export **isn't a full backup** (login sessions, for example, are left out).",
          },
        ],
      },
    ],
  },

  reports: {
    requires: ["finance"],
    label: "Reports & closing",
    summary: "How to read your numbers, and how to close the month.",
    sections: [
      {
        title: "Available reports",
        path: "/admin/reports",
        blocks: [
          {
            type: "list",
            items: [
              "**Profit and loss**: sales (on delivery) less cost of sales = gross profit, less expenses = net profit. Compared with the same number of days just before.",
              "**Cash flow**: all money in and out in the period, by cause. Transfers between accounts net to zero.",
              "**Customer receivables**: what customers still owe on delivered orders, aged from delivery.",
              "**Supplier payables**: what you owe suppliers, aged from receipt of the goods.",
              "**Inventory valuation**: stock on hand now at its cost.",
              "**Trial balance**: every ledger account's totals up to a chosen day — debits must equal credits.",
              "**Sales by product**: units sold, net sales, cost and margin per product.",
            ],
          },
          { type: "tip", text: "Every report can be downloaded for Excel with **Download CSV**." },
        ],
      },
      {
        title: "Why does home-page revenue differ from the order count?",
        path: "/admin",
        blocks: [
          {
            type: "p",
            text: "**Net revenue** on the home page counts orders **delivered** in the period, net of discounts and refunds. Orders placed but not yet delivered count toward the number of orders, not toward revenue.",
          },
        ],
      },
      {
        title: "Books and closing",
        path: "/admin/books",
        blocks: [
          {
            type: "p",
            text: "**Reconciliation** compares each figure against two independent records (e.g. a courier's balance against their collections). When everything holds you'll see **All checks pass**; otherwise the failing check lists the documents behind it.",
          },
          {
            type: "steps",
            title: "Closing a period (super admin only)",
            items: [
              "Make sure every check passes (click **Run again** if needed).",
              "Pick a date in **Close through** — today can't be closed.",
              "Click **Close period**. Every day up to that date is frozen and can't take new records.",
            ],
          },
          {
            type: "p",
            text: "To fix something in a closed period, click **Reopen** and give a reason (you can keep part of it closed). Reopening is kept in the history.",
          },
        ],
      },
      {
        title: "Suggested month-end routine",
        blocks: [
          {
            type: "steps",
            items: [
              "**Settle** with every courier.",
              "Make sure every delivered order has its collection recorded.",
              "Record all **expenses** (rent, salaries, ads…).",
              "Post any draft **purchases** whose goods have arrived.",
              "Review **Customer receivables** and **Supplier payables**.",
              "Compare each **money account** balance with what's really in the till and the bank.",
              "Run **Reconciliation**, and if all is well, **close the month**.",
            ],
          },
        ],
      },
    ],
  },
};

export default en;
