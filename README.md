# Fix &amp; Drive

Offline-first PWA for the Fix and Drive auto garage: invoices, expenses, customer
and vehicle history, and a live job board. Installs to an Android or iPhone home
screen and runs with no network at all.

**Live:** https://moesb1.github.io/fixanddrive/

## Installing it on the phone

**Android (Chrome)** — open the link, then tap the "Install" bar at the top of the
New Bill screen (or menu ⋮ → *Install app*).

**iPhone (Safari)** — open the link, tap **Share**, then **Add to Home Screen**.

Once installed it opens full screen, with no browser bars, and works with the phone
in airplane mode.

## The five tabs

| Tab | What it does |
| --- | --- |
| **New Bill** | Build an invoice: customer, vehicle, line items tagged Parts or Labour, discount, tax. Save, print, or send. |
| **Bills** | Every saved bill. Search, mark paid/unpaid, edit, duplicate, print, send, delete. Backup and restore as JSON. |
| **Expenses** | Log shop costs by category. Shows total spent, this month, and net profit against invoice revenue. |
| **History** | Customers and vehicles rolled up from saved bills: visit counts, totals, last service, unpaid counts. |
| **Job Board** | Cars currently in the shop. Each job moves Waiting → In Progress → Done → Collected, and can be turned into a bill in one tap. |

## Printing and WhatsApp

**Print** renders a full A4 invoice and opens the phone's print dialog. Choose
*Save as PDF* to get a file, or send it straight to a printer.

**Send** is a two-step flow, because WhatsApp has no way to attach a file from a web
page: print the invoice to PDF first, then open the customer's chat and attach it
with the 📎 clip button. Lebanese numbers are normalised automatically, so `03 456 789`
opens the chat for `+961 3 456 789`.

## Where the data lives

Everything is in the phone's `localStorage` — there is no server and no account.

| Key | Contents |
| --- | --- |
| `fixdrive_v2_bills` | bills |
| `fixdrive_expenses` | expenses |
| `fixdrive_jobs` | job board |
| `fixdrive_currency` | selected display currency |

These are the same keys the previous single-file version used, so existing data on a
phone carries over untouched.

Because the data is on the device, **use Bills → Backup regularly**. Clearing the
browser's site data, or deleting the app, deletes the bills with it. Restore reads
the backup file back in.

## Currency

Amounts are stored in whichever currency was selected when the bill was saved, and
converted on the fly for display. Rates are fixed constants in `app.js` (`RATES`),
sourced June 2026 — edit them there when they drift.

## Files

```
index.html   markup and the five tab panes
style.css    all styling, including the printed A4 invoice sheet
app.js       all behaviour, no dependencies, no build step
sw.js        service worker: precaches the shell, serves cache-first
manifest.json
icons/       app icons (192, 512, maskable, apple-touch)
```

## Editing it

There is no build step — edit a file and reload.

One thing to remember: `sw.js` serves everything **cache-first**, so a browser that
has already loaded the app will keep showing the old files. After changing anything,
bump `CACHE_VERSION` in `sw.js` (`fixdrive-v1` → `fixdrive-v2`, …). That is what
tells installed phones to throw away the old cache and pull the new build.

To test locally:

```bash
python3 -m http.server 8791 --directory .
```

Then open http://localhost:8791 — a service worker needs `http://` or `https://`,
so opening `index.html` from the filesystem will not exercise the offline path.
