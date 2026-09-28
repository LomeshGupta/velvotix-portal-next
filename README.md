# Velvotix Portal (Next.js) - step 1
```bash
cp .env.example .env    # set JWT_SECRET; DEMO_MODE=true works without Google
npm install
npm run dev             # http://localhost:3000
```
Dev logins: admin@velvotix.local / Admin@12345, support@velvotix.local / Support@12345, client@example.com / Client@12345
Google mode: DEMO_MODE=false + service-account vars; leave GOOGLE_SPREADSHEET_ID empty to auto-create (copy the logged ID into .env). Deploy on Vercel with the same env vars.
Built: Sheets init/retry/cache layer, auth (JWT cookie), role guards, customers API + UI, theme toggle, login.
Also built (API only, no UI yet): contracts (expiry status), GST invoices + items + payments (CGST/SGST vs IGST from Company state vs Place of Supply), tickets + chat + activity timeline (internal notes hidden from customers), company settings.
Not built: UI for those modules, dashboards, notification/search endpoints, forgot-password, attachments, invoice print page, PDF.

## Logins
Customer: `/` -> `/portal/tickets` (own tickets list, status, raise ticket only).
Staff: `/admin/login` -> `/admin/tickets` (filter by customer), `/admin/invoices` (raise invoice, past invoices, ledger, record payment), `/customers`.
Customer credentials cannot sign in on the admin page and vice versa; customer users are denied by the API on invoices, contracts and customers.
Google access: use a service account (GOOGLE_CLIENT_EMAIL / GOOGLE_PRIVATE_KEY). A plain API key cannot write to Sheets.

## Demo mode
Runs on in-memory dummy data (2 customers, contracts, 3 tickets, 3 invoices, payments). Enabled when DEMO_MODE=true, or automatically in development when Google credentials are missing. Data resets on restart. In production the app never falls back to demo.
If you still see "service unavailable" in dev, the terminal shows the cause (and the API response includes `detail`).

## UI
Admin: sidebar layout, dashboard (KPIs + charts), Jira-style drag-and-drop ticket board with search/customer filter, ticket page (chat, internal notes, assignee/priority/status, activity), click any invoice for the printable A4 GST invoice (Print / Save as PDF). Customer portal: click a ticket to chat and see status.
Run `npm install` again (recharts added).

## Hours, customers, portal
- Customer 360 page (`/admin/customers/[id]`): full profile with billing/shipping address, invoices, tickets, support-hours ledger. Admins add hours with an expiry date.
- Assigned staff raise hour requests on a ticket; an admin or the customer approves (deducts from the balance; blocked if insufficient).
- Staff can create tickets on behalf of a customer (Tickets board -> New ticket).
- Invoice form has an editable billing address (stored per invoice). New sheet tabs HoursLedger/HourRequests are created automatically; existing Invoices sheets need a `billingAddress` header added in column T if you already initialised them.
