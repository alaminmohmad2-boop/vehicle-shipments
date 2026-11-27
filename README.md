# Vehicle Shipments

Book vehicle shipments VIN by VIN over multi-port routes, record their milestones, bill them from tariff rules, print bills of lading and invoices, and share a tracking link with customers.

Inspired by https://logisoft.io

Built with [oss.new](https://oss.new) for [EveryApp](https://github.com/every-app/every-app).

## Features

- Create bookings with customer, carrier, vessel and voyage, an ordered route of legs and vehicles by VIN with dimensions and weight.
- Record status milestones with time, place and note, see the timeline, and set a different status on single vehicles.
- Find bookings by number, VIN, customer, vessel or port, filtered by status, carrier and departure date.
- Keep tariff rules (admins), turn them into charge lines, issue numbered invoices, mark them paid or void them with a credit note.
- Print a bill of lading or an invoice, and upload, download and delete PDF and image attachments.
- Share a revocable public link that shows a booking's route, milestones and vehicles without prices or customer details.
- A dashboard (active shipments, open and overdue balance, bookings by status) and CSV exports for Excel (bookings, vehicles, invoices, customers) with a per-customer report.
- A Yard section (ported from SWAKEN): storage yards with capacity and live occupancy, gate entry/exit log (driver, truck plate, seal), vehicle moves between zones and slots, inspections (condition, odometer, fuel, damage notes) and release requests that admins approve or reject.
- Navy sidebar layout, Arabic RTL and English, light and dark themes.

Left out: accounts and sign-in, which your Gateway handles; terminal and yard operations; CRM and quotations; EDI, customs filing and accounting integrations; voyage planning; customer self-booking, schedules and notifications; the mobile app; custom domains; professional services.

## Setup

```sh
pnpm install
pnpm dev            # run locally, signed in as a test user
pnpm test           # unit tests
pnpm run deploy     # put it on your Cloudflare account behind your Gateway
```

Or install a release with `pnpm everyapp install <repository url>`. The app needs no secrets or settings: it uses a D1 database and an R2 bucket (`files`), both created on the first deploy. R2 has to be enabled once on the Cloudflare account. Every member of the organization can open it; owners and admins see every booking and edit the tariffs.

## Limitations

- Members see only the bookings they created; there is no sharing between members other than through owners and admins.
- Documents are print views: use the browser's print dialog to save them as PDF.
- Attachments are PDFs and images up to 20 MB each.
- Amounts are kept with two decimals per currency. Tax (default percent in Company, overridable per invoice), one fee and a typed USD/SDG rate are kept on each invoice; there are no live rates.
