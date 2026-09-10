// Iranian numbers arrive in local form ("09xxxxxxxxx"); wa.me needs the full
// international form with no leading zero.
export function toInternationalIranPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("98")) return digits;
  if (digits.startsWith("0")) return `98${digits.slice(1)}`;
  return `98${digits}`;
}

export function buildWhatsAppShareUrl(message: string, phone?: string | null): string {
  const text = encodeURIComponent(message);
  return phone
    ? `https://wa.me/${toInternationalIranPhone(phone)}?text=${text}`
    : `https://api.whatsapp.com/send?text=${text}`;
}

// Telegram's web share endpoint always opens the app's own contact/chat
// picker — there's no reliably cross-client way to target a phone number
// directly the way wa.me does for WhatsApp.
export function buildTelegramShareUrl(link: string, message: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(message)}`;
}
