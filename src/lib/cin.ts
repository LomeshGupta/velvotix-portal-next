import { z } from 'zod';
/** Corporate Identification Number: 21 characters, e.g. U74999HR2020PTC000000 (listing status, industry, state, year, ownership, serial). */
export const CIN_RE = /^[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/;
export const CIN_EXAMPLE = 'U74999HR2020PTC000000';
/** Trims, upper-cases and validates. An empty string is allowed here; "required" rules are applied by the caller. */
export const cinField = z.string().trim().toUpperCase().refine(v => v === '' || CIN_RE.test(v), { message: `Invalid CIN. It has 21 characters, e.g. ${CIN_EXAMPLE}` });
