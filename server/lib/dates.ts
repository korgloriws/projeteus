/** Converts a JS Date (as produced by zod.coerce.date()) into a YYYY-MM-DD
 * string suitable for a Drizzle `date(..., { mode: "string" })` column. */
export function toDateOnly(value: Date | null | undefined): string | null | undefined {
  if (value === null || value === undefined) return value;
  return value.toISOString().slice(0, 10);
}
