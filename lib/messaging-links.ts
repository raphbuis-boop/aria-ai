export function cleanPhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function waMePhone(phone: string): string {
  const digits = cleanPhone(phone);
  if (digits.length === 10) return "1" + digits;
  return digits;
}

export function smsUrl(phone: string, body: string): string {
  const digits = cleanPhone(phone);
  const encoded = encodeURIComponent(body);
  return `sms:${digits}?&body=${encoded}`;
}

export function whatsAppUrl(phone: string, body: string): string {
  const phoneForWa = waMePhone(phone);
  const encoded = encodeURIComponent(body);
  return `https://wa.me/${phoneForWa}?text=${encoded}`;
}
