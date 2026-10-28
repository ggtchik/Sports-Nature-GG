/**
 * Formatage des dates et nombres pour l'affichage.
 * Toutes les heures sont rendues dans le fuseau du spot (utcOffsetSeconds fourni
 * par Open-Meteo), jamais dans le fuseau du navigateur, afin qu'une donnée
 * corresponde toujours au spot + date + heure (§25).
 */

export interface TimeContext {
  timezone: string;
  utcOffsetSeconds: number;
}

const cache = new Map<string, (d: Date) => string>();

/**
 * Fabrique un formateur de date robuste.
 *
 * Ordre de préférence :
 *  1. le fuseau IANA fourni par la source (ex. « Europe/Paris ») ;
 *  2. à défaut, un décalage fixe en secondes, appliqué arithmétiquement puis
 *     formaté en UTC. On ne passe JAMAIS un libellé de fuseau construit à la
 *     main (type « UTC+02:00 ») à `Intl.DateTimeFormat` : ce n'est pas un
 *     identifiant de fuseau valide et lèverait une `RangeError`.
 */
function makeFormatter(
  ctx: TimeContext,
  opts: Intl.DateTimeFormatOptions,
): (d: Date) => string {
  const key = `${ctx.timezone}|${ctx.utcOffsetSeconds}|${JSON.stringify(opts)}`;
  const cached = cache.get(key);
  if (cached) return cached;

  let fn: (d: Date) => string;
  try {
    const f = new Intl.DateTimeFormat('fr-FR', { timeZone: ctx.timezone, ...opts });
    f.format(new Date(0)); // validation immédiate du fuseau
    fn = (d: Date) => f.format(d);
  } catch {
    const utc = new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', ...opts });
    fn = (d: Date) => utc.format(new Date(d.getTime() + ctx.utcOffsetSeconds * 1000));
  }

  cache.set(key, fn);
  return fn;
}

/** Heure locale du spot : 14:05 */
export function formatTime(iso: string | null | undefined, ctx: TimeContext): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return makeFormatter(ctx, { hour: '2-digit', minute: '2-digit', hour12: false })(d);
}

/** Heure locale du spot avec secondes : 14:05:32 */
export function formatTimeWithSeconds(iso: string | null | undefined, ctx: TimeContext): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return makeFormatter(ctx, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })(d);
}

/** Date locale du spot : 28/10/2026 */
export function formatDate(iso: string | null | undefined, ctx: TimeContext): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return makeFormatter(ctx, { day: '2-digit', month: '2-digit', year: 'numeric' })(d);
}

/** Date courte : lun. 28 oct. */
export function formatDateShort(iso: string | null | undefined, ctx: TimeContext): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return makeFormatter(ctx, { weekday: 'short', day: 'numeric', month: 'short' })(d);
}

/** Date + heure : 28/10/2026 14:05 */
export function formatDateTime(iso: string | null | undefined, ctx: TimeContext): string {
  if (!iso) return '—';
  return `${formatDate(iso, ctx)} ${formatTime(iso, ctx)}`;
}

/** Jour de la semaine seul : Lundi */
export function formatWeekday(iso: string | null | undefined, ctx: TimeContext): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const s = makeFormatter(ctx, { weekday: 'long' })(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Libellé relatif « il y a 5 min ». */
export function formatRelative(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const diff = Math.round((now - t) / 1000);
  if (diff < 0) return 'à l’instant';
  if (diff < 45) return 'à l’instant';
  if (diff < 90) return 'il y a 1 min';
  if (diff < 3600) return `il y a ${Math.round(diff / 60)} min`;
  if (diff < 5400) return 'il y a 1 h';
  if (diff < 86400) return `il y a ${Math.round(diff / 3600)} h`;
  return `il y a ${Math.round(diff / 86400)} j`;
}

/** Nombre à la française (virgule décimale). */
export function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/** Montant en euros. */
export function formatEuro(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Heure « 14:05 » depuis une chaîne ISO simple renvoyée par l'API (déjà locale). */
export function formatApiTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** Date ISO locale (YYYY-MM-DD) pour un instant donné. */
export function isoDateIn(date: Date, ctx: TimeContext): string {
  const shifted = new Date(date.getTime() + ctx.utcOffsetSeconds * 1000);
  return shifted.toISOString().slice(0, 10);
}

/** Ajoute des jours à une date ISO. */
export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
