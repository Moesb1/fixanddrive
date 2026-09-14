# Fix &amp; Drive

Offline-first management app for the Fix and Drive auto garage: customers and
vehicles, digital job cards, invoices, parts inventory, suppliers, expenses and a
daily cash register. One codebase that lays itself out as a desktop tool on a
laptop and as a touch app on a phone, and runs with no network either way.

**Live:** https://moesb1.github.io/fixanddrive/

## On the laptop

Just open the link. Chrome and Edge will also offer to install it (the ⊕ in the
address bar, or menu → *Install*), which gives it its own window and a dock/taskbar
icon with no browser chrome.

The laptop layout kicks in at 1024px wide and is built around the keyboard:

| Key | Does |
| --- | --- |
| `Tab` | Next field. Inside the items table: description → type → qty → price. |
| `Enter` | Jump to the next line item, adding a new line if you are on the last one. |
| `⌘S` / `Ctrl+S` | Save the bill. |
| `⌘P` / `Ctrl+P` | Print / save as PDF. |
| `Esc` | Close a dialog. |

Line items are a proper table here, so a full bill can be typed without touching
the trackpad: type the description, Tab to qty and price, Enter for the next line.

## On the phone

**Android (Chrome)** — open the link, tap the "Install" bar on the New Bill screen
(or menu ⋮ → *Install app*).

**iPhone (Safari)** — open the link, tap **Share**, then **Add to Home Screen**.

Below 1024px the same app becomes a touch layout: bottom tab bar, one column, big
controls, and each line item becomes its own card instead of a table row.

## The five tabs

Eleven separate screens would defeat the point of a simple app, so the features
are grouped into five, each with at most two sub-tabs.

| Tab | Sub-tabs | What it does |
| --- | --- | --- |
| **Bills** | New · Saved | Build an invoice: customer, vehicle, line items tagged Parts or Labour, discount, tax. Save, print, send on WhatsApp, take payment. Search, mark paid/unpaid, edit, duplicate, delete. Backup and restore as JSON. |
| **Jobs** | — | Digital job cards for the cars in the shop: problem reported, inspection findings, parts used, labour, mechanic, running total. Moves Waiting → In Progress → Done → Collected and becomes an invoice in one click. |
| **People** | Customers · Vehicles | The customer and vehicle database: phone, address, notes; make, model, year, plate, VIN, mileage, next service due, repair history. |
| **Shop** | Parts · Suppliers | Parts inventory with stock levels, cost and sell price, and low-stock alerts. Suppliers with what they supply, purchase history and what is still owed. |
| **Money** | Today · Expenses | The daily cash register: takings split by Cash / Whish / Bank Transfer / Card, minus the day's expenses, showing the net. Plus the expense log by category. |

### How they connect

The point of keeping it one app is that the records reference each other:

```
Customer ─ owns ─> Vehicle ─ booked in on ─> Job Card
                                                │
                              consumes Parts ───┤  (stock drops immediately)
                                                │
                                          becomes Invoice
                                                │
                                          takes Payment ──> Daily register
```

- Adding a part to a job card **takes it out of stock there and then**. Removing
  it puts it back. That is the only place stock is consumed, so the numbers
  cannot drift.
- Booking in a delivery from a supplier **adds to stock**, updates the part's
  cost price, and leaves the purchase outstanding until it is marked paid.
- Saving a bill for a name that is not on file **creates the customer and the
  vehicle automatically**, so the database fills itself as he works instead of
  needing everything entered twice.
- A payment that covers the balance **marks the bill paid on its own**. Partial
  payments show what is still due.

## Printing and WhatsApp

**Print** renders a full A4 invoice and opens the print dialog. Choose *Save as PDF*
for a file, or send it to a printer. Bills longer than seven lines compress their
row height so the invoice still fits on one page.

**Send** is a two-step flow, because WhatsApp gives web pages no way to attach a
file: print the invoice to PDF first, then open the customer's chat and attach it.
On a laptop that opens WhatsApp Web, where the PDF can also just be dragged into
the conversation. Lebanese numbers are normalised automatically, so `03 456 789`
opens the chat for `+961 3 456 789`.

## Where the data lives

Everything is in `localStorage` on the device — no server, no account, no sync.

| Key | Contents |
| --- | --- |
| `fixdrive_v2_bills` | bills |
| `fixdrive_expenses` | expenses |
| `fixdrive_jobs` | job cards |
| `fixdrive_currency` | selected display currency |
| `fixdrive_customers` | customers |
| `fixdrive_vehicles` | vehicles |
| `fixdrive_parts` | parts inventory |
| `fixdrive_suppliers` | suppliers |
| `fixdrive_purchases` | stock bought in |
| `fixdrive_payments` | payments taken, by method |
| `fixdrive_migrated` | marks the one-time upgrade as done |

The first four keys are the originals and never change, so a device that already
had the app keeps everything. On first run of this version the old bills are
rolled up into real customer and vehicle records (deduplicated by name and plate,
with `Toyota Corolla 2020` split into make, model and year) and the bills are
back-linked to them. It runs once and marks itself done.

**The laptop and the phone are separate copies.** Because the data never leaves the
device, a bill written on the phone does not appear on the laptop. To move
everything across, use **Bills → Backup** on the old device and **Restore** on the
new one. Same story for ordinary safekeeping: back up regularly, since clearing
site data or deleting the app takes the bills with it.

## Currency

Amounts are stored in whichever currency was selected when the bill was saved, and
converted on the fly for display. Rates are fixed constants in `app.js` (`RATES`),
sourced June 2026 — edit them there when they drift.

## Files

```
index.html   markup: nine panes behind five nav groups
style.css    all styling: phone layout, the ≥1024px laptop layout, and the
             printed A4 invoice sheet
data.js      store keys, record shapes, relationships, the one-time migration
app.js       shell: currency, toasts, sheets, nav, bills, print, WhatsApp
people.js    customers and vehicles
shop.js      parts inventory, suppliers, purchases
jobs.js      digital job cards
money.js     payments and the daily register
sw.js        service worker: precaches the shell, serves cache-first
manifest.json
icons/       app icons (192, 512, maskable, apple-touch)
```

`data.js` loads first (everything else depends on its accessors), then `app.js`
(which owns the shared `formSheet` / `infoSheet` / `fieldText` helpers), then the
four feature modules. **A new file must be added to `PRECACHE` in `sw.js`** or it
will not be there offline.

## Editing it

No build step — edit a file and reload.

**After changing anything, bump `CACHE_VERSION` in `sw.js`** (`fixdrive-v4` →
`fixdrive-v5`, …). The service worker serves cache-first, so without that bump an
installed phone or laptop keeps running the old build forever.

With the bump, the first visit after a deploy still renders the old page while the
new worker installs behind it — so the app reloads itself once when the new worker
takes over, and the user lands on the new version without knowing anything
happened. During local development that safety net is not enough: unregister the
worker and clear caches between reloads, or you will be testing stale files.

A few layout notes worth knowing before editing the CSS:

- The laptop layout reuses the phone markup. `display:contents` dissolves the item
  card's inner wrappers so each control becomes a direct grid cell, letting one
  column template line the rows up with the header. There is no second markup path,
  so changing a field means changing it once.
- The delete button on a line item sits **last** in the DOM so Tab does not land on
  a destructive control halfway through the row; CSS moves it back to the card's
  top-right corner on phones.
- `html`/`body` use `overflow-x:clip`, not `hidden`. `hidden` turns the root into a
  scroll container and silently breaks `position:sticky` for the app bar and the
  sidebar.
- Everything responsive is scoped to `@media screen and …` so none of it reaches
  the printed invoice.
- Every add/edit form in the app is built from `fieldText()` and rendered into
  the one shared `formSheet`. An `onConfirm` returning `false` keeps the sheet
  open, which is how validation failures report back.

To test locally:

```bash
python3 -m http.server 8791 --directory .
```

Then open http://localhost:8791 — a service worker needs `http://` or `https://`,
so opening `index.html` from the filesystem will not exercise the offline path.
