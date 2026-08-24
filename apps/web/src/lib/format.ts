/**
 * Amounts are stored in Rial (integer, see backend/docs/02-database.md) but
 * shown to users in Toman (1 Toman = 10 Rial) — the everyday unit, matching
 * every hardcoded priceLabel in prisma/seed.ts (e.g. "از ۵٬۰۰۰٬۰۰۰ تومان").
 * Digit grouping stays Latin (`toLocaleString("en-US")`), matching the one
 * existing dynamic-number precedent in this app (`Countdown`'s MM:SS).
 */
export function formatToman(rial: number): string {
  return `${Math.floor(rial / 10).toLocaleString("en-US")} تومان`;
}

/**
 * `Profile.fullName` is one string (no separate first/last name fields on
 * the backend — see backend/prisma/schema.prisma). GlobalHeader's identity
 * slot needs just the first name (docs/navigation-route-contract.md §4),
 * so this takes the first word rather than the whole name.
 */
export function getFirstName(fullName: string | null): string | null {
  if (!fullName) return null;
  return fullName.trim().split(/\s+/)[0] ?? null;
}
