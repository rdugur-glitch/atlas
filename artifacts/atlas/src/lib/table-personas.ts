export const PERSONAS = [
  { id: 'atlas', name: 'ATLAS', role: 'Şahsi Asistan', domain: 'personal', color: '#54dbff', note: 'Gününüz, görevleriniz ve ajandanız.' },
  { id: 'mira', name: 'MIRA', role: 'Müşteri & CRM', domain: 'crm', color: '#e8506a', note: 'Müşteriler, teklifler ve takipler.' },
  { id: 'nova', name: 'NOVA', role: 'Muhasebe & Finans', domain: 'finance', color: '#4d86ff', note: 'Gelir, gider ve nakit akışı. Kayıt yoksa rakam uydurmaz.' },
  { id: 'vex', name: 'VEX', role: 'Reklam & Performans', domain: 'ads', color: '#ffb12e', note: 'Kampanyalar, bütçe ve performans.' },
  { id: 'luna', name: 'LUNA', role: 'Sosyal Medya & İçerik', domain: 'social', color: '#d95cff', note: 'İçerik fikirleri ve yayın planı.' },
  { id: 'orion', name: 'ORION', role: 'Operasyon & Strateji', domain: 'operations', color: '#38e0a0', note: 'Projeler, süreçler ve öncelikler.' },
] as const;
export type PersonaId = typeof PERSONAS[number]['id'];
export const persona = (id?: string) => PERSONAS.find(p => p.id === id) ?? PERSONAS[0];
/** Provisional visual focus only. The authenticated server makes the actual route. */
export function addressedForUI(text: string): PersonaId[] {
  let rest = text.trim().toLocaleLowerCase('tr-TR').replace(/ı/g, 'i').replace(/^(?:hey|merhaba|selam)\s*[,! ]\s*/, '');
  const whole = rest;
  const ids: PersonaId[] = [];
  while (rest) {
    const match = /^(atlas|mira|nova|vex|veks|luna|orion|oryon|asistanim)(?=[\s,;:.!?&+]|$)/.exec(rest);
    if (!match) break;
    const id = ({ asistanim: 'atlas', veks: 'vex', oryon: 'orion' } as Record<string, PersonaId>)[match[1]] ?? match[1] as PersonaId;
    if (!ids.includes(id)) ids.push(id);
    rest = rest.slice(match[0].length).replace(/^[\s,;:.!?&+]+/, '').replace(/^(?:ve|ile)\s+/, '');
  }
  for (const match of whole.matchAll(/(?:^|[;.!?,\n]|\sve\s)\s*(atlas|mira|nova|vex|veks|luna|orion|oryon|asistanim)(?=[\s,;:.!?&+]|$)/g)) {
    const id = ({ asistanim: 'atlas', veks: 'vex', oryon: 'orion' } as Record<string, PersonaId>)[match[1]] ?? match[1] as PersonaId;
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}
export function greeting(date = new Date()) {
  const hour = date.getHours();
  const period = hour >= 5 && hour < 12 ? 'Günaydın' : hour >= 12 && hour < 18 ? 'İyi günler' : 'İyi akşamlar';
  return `${period}, ${['buradayım.', 'dinliyorum.', 'masa hazır.'][Math.floor(Math.random() * 3)]}`;
}
