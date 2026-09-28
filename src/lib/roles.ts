export const ROLES = ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'ACCOUNTS', 'SALES', 'CUSTOMER'] as const;
export const ADMINS = ['SUPER_ADMIN', 'ADMIN'];
/** SUPER_ADMIN manages everyone; ADMIN manages everyone except SUPER_ADMIN. */
export const canManage = (actor: string, target: string) => actor === 'SUPER_ADMIN' || (actor === 'ADMIN' && target !== 'SUPER_ADMIN');
