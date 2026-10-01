'use client';
import { createContext, useContext } from 'react';
/** Current user's role, provided once by the admin layout (which already reads /api/auth/me), so pages need no extra request. '' until loaded. */
export const RoleContext = createContext('');
export const useRole = () => useContext(RoleContext);
export const hasRole = (role: string, list: readonly string[]) => list.includes(role);
