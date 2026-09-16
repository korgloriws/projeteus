import { format, isValid, parse } from "date-fns";
import { ptBR } from "date-fns/locale";

/** Interpreta `yyyy-MM-dd` como data local (evita -1 dia por UTC). */
export function parseISODateOnly(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const iso = value.slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return isValid(date) ? date : undefined;
}

export function toISODateOnly(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function formatDatePtBR(
  value: string | Date | null | undefined,
): string {
  if (!value) return "";
  const date =
    value instanceof Date ? value : parseISODateOnly(String(value));
  if (!date || !isValid(date)) return "";
  return format(date, "dd/MM/yyyy", { locale: ptBR });
}

export function formatDateTimePtBR(
  value: string | Date | null | undefined,
): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (!isValid(date)) return "";
  return format(date, "dd/MM/yyyy HH:mm", { locale: ptBR });
}

/** Aceita digitação `dd/mm/yyyy` e devolve `yyyy-MM-dd` ou null. */
export function parseDatePtBRToISO(text: string): string | null {
  const cleaned = text.trim();
  if (!cleaned) return null;
  const parsed = parse(cleaned, "dd/MM/yyyy", new Date());
  if (!isValid(parsed)) return null;
  return toISODateOnly(parsed);
}
