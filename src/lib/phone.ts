/** Normalize Indonesian mobile to digits with country code 62 (no +). */
export function normalizeIdPhone(phone: string): string {
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("0")) d = `62${d.slice(1)}`;
  if (!d.startsWith("62") && d.length >= 9) d = `62${d}`;
  return d;
}

export function telHref(phone: string): string {
  return `tel:+${normalizeIdPhone(phone)}`;
}

export function waHref(phone: string, text?: string): string {
  const base = `https://wa.me/${normalizeIdPhone(phone)}`;
  if (!text) return base;
  return `${base}?text=${encodeURIComponent(text)}`;
}

export function displayPhone(phone: string): string {
  return phone.trim();
}
