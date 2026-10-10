export function validTimeZone(zone: string): boolean {
  try { new Intl.DateTimeFormat('tr-TR', { timeZone: zone }).format(); return true; } catch { return false; }
}
export function deviceTimeZone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Istanbul'; } catch { return 'Europe/Istanbul'; }
}
export function roomGreeting(name: string, zone: string, date = new Date()): string {
  const timeZone = validTimeZone(zone) ? zone : deviceTimeZone();
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(date));
  const period = hour >= 5 && hour < 12 ? 'Günaydın' : hour >= 12 && hour < 18 ? 'İyi günler' : 'İyi akşamlar';
  return `${period}${name.trim() ? ` ${name.trim()}` : ''}, buradayım.`;
}
