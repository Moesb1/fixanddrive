# Fix &amp; Drive

Offline-first app for the Fix and Drive auto garage: invoices, expenses, customer
and vehicle history, and a live job board. One codebase that lays itself out as a
desktop tool on a laptop and as a touch app on a phone, and runs with no network
either way.

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

| Tab | What it does |
| --- | --- |
| **New Bill** | Build an invoice: customer, vehicle, line items tagged Parts or Labour, discount, tax. Save, print, or send. |
| **Bills** | Every saved bill. Search, mark paid/unpaid, edit, duplicate, print, send, delete. Backup and restore as JSON. |
| **Expenses** | Log shop costs by category. Shows total spent, this month, and net profit against invoice revenue. |
| **History** | Customers and vehicles rolled up from saved bills: visit counts, totals, last service, unpaid counts. |
| **Job Board** | Cars currently in the shop. Each job moves Waiting → In Progress → Done → Collected, and can be turned into a bill in one click. |

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
| `fixdrive_jobs` | job board |
| `fixdrive_currency` | selected display currency |

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
index.html   markup and the five tab panes
style.css    all styling: phone layout, the ≥1024px laptop layout, and the
             printed A4 invoice sheet
app.js       all behaviour, no dependencies, no build step
sw.js        service worker: precaches the shell, serves cache-first
manifest.json
icons/       app icons (192, 512, maskable, apple-touch)
```

## Editing it

No build step — edit a file and reload.

**After changing anything, bump `CACHE_VERSION` in `sw.js`** (`fixdrive-v2` →
`fixdrive-v3`, …). The service worker serves cache-first, so without that bump an
installed phone or laptop keeps running the old build forever. The same thing bites
during local development: unregister the worker and clear caches between reloads, or
you will be testing stale files.

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

To test locally:

```bash
python3 -m http.server 8791 --directory .
```

Then open http://localhost:8791 — a service worker needs `http://` or `https://`,
so opening `index.html` from the filesystem will not exercise the offline path.
