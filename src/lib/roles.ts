export const ROLES = ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'ACCOUNTS', 'SALES', 'CUSTOMER'] as const;
export const ADMINS = ['SUPER_ADMIN', 'ADMIN'];
/** SUPER_ADMIN manages everyone; ADMIN manages everyone except SUPER_ADMIN. */
export const canManage = (actor: string, target: string) => actor === 'SUPER_ADMIN' || (actor === 'ADMIN' && target !== 'SUPER_ADMIN');

/**
 * Central access matrix. Server routes AND the admin navigation read these same lists, so they cannot drift apart.
 * (Constants only - no React/server imports - so this file is safe to import from both sides.)
 */
/** Tickets, support hours, contract / product view. ACCOUNTS is deliberately not here. */
export const SUPPORT_VIEW = ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'SALES'] as const;
/** Invoices and ledger (view). SUPPORT is deliberately not here. */
export const FINANCE_VIEW = ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTS', 'SALES'] as const;
/** Create / edit / delete invoices and record payments. To let ACCOUNTS do this again, add 'ACCOUNTS' here (one place). */
export const INVOICE_WRITE = ['SUPER_ADMIN', 'ADMIN'] as const;
/** Financial dashboard. */
export const DASHBOARD_VIEW = ['SUPER_ADMIN', 'ADMIN', 'SALES', 'ACCOUNTS'] as const;
/** Mirror of STAFF_WRITE in lib/api.ts: contracts and customer records (unchanged). */
export const RECORD_WRITE = ['SUPER_ADMIN', 'ADMIN', 'SALES'] as const;
/** Contract hours and product master: administrators only. */
export const HOURS_WRITE = ADMINS;
/** Product / service master page in the sidebar. Reading the list (for contract tagging) stays open to SUPPORT_VIEW as before. */
export const PRODUCTS_VIEW = ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTS'] as const;
/** Vendor / purchase records: same visibility as customer invoices, kept out of SUPPORT. */
export const PURCHASE_VIEW = ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTS'] as const;
export const PURCHASE_WRITE = ADMINS;

const PATHS: Record<string, string[]> = {
  SUPPORT: ['/admin/tickets', '/admin/customers', '/admin/contracts'],
  ACCOUNTS: ['/admin/invoices', '/admin/customers', '/admin/products', '/admin/purchases', '/admin/dashboard'],
};
/** Which /admin pages a role may open. Roles without an entry (SUPER_ADMIN, ADMIN, SALES) keep all pages as before. */
export const canAccessPath = (role: string, path: string) => !PATHS[role] || PATHS[role].some(p => path.startsWith(p));
/** Where a role lands after signing in. */
export const homeFor = (role: string) =>
  role === 'CUSTOMER' ? '/portal/tickets' : role === 'SUPPORT' ? '/admin/tickets' : role === 'ACCOUNTS' ? '/admin/invoices' : '/admin/dashboard';
