/**
 * Couche HTTP minimale : timeout, nouvelles tentatives, erreurs typées.
 *
 * Aucune clé secrète n'est manipulée ici : toutes les sources utilisées par
 * défaut sont ouvertes et sans authentification (§16, §22).
 */

export class HttpError extends Error {
  readonly status: number;
  readonly url: string;

  constructor(message: string, status: number, url: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.url = url;
  }
}

export interface RequestOptions {
  timeoutMs?: number;
  retries?: number;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

export async function getJson<T>(
  url: string,
  { timeoutMs = 15000, retries = 1, signal, headers }: RequestOptions = {},
): Promise<T> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json', ...headers },
      });
      if (!res.ok) {
        throw new HttpError(
          `Réponse ${res.status} pour ${res.url || url}`,
          res.status,
          url,
        );
      }
      return (await res.json()) as T;
    } catch (err) {
      lastError = err;
      // 4xx (hors 429) : inutile de réessayer.
      if (err instanceof HttpError && err.status >= 400 && err.status < 500 && err.status !== 429) {
        throw err;
      }
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Échec de la requête ${url}`);
}

/** Texte brut (CSV, etc.). */
export async function getText(
  url: string,
  { timeoutMs = 15000, retries = 1, signal }: RequestOptions = {},
): Promise<string> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new HttpError(`Réponse ${res.status}`, res.status, url);
      return await res.text();
    } catch (err) {
      lastError = err;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Échec de la requête ${url}`);
}

/** Construit une URL avec des paramètres, en ignorant les valeurs nulles. */
export function buildUrl(
  base: string,
  params: Record<string, string | number | boolean | undefined | null>,
): string {
  const url = new URL(base);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    url.searchParams.set(k, String(v));
  }
  return url.toString();
}

/** Message d'erreur lisible, quel que soit le type d'échec. */
export function describeError(err: unknown): string {
  if (err instanceof HttpError) {
    if (err.status === 429) return 'Limite d’appels de la source atteinte, réessayez dans un instant.';
    if (err.status === 404) return 'Donnée non trouvée sur la source.';
    if (err.status >= 500) return `Source momentanément indisponible (${err.status}).`;
    return `Source indisponible (${err.status}).`;
  }
  if (err instanceof DOMException && err.name === 'AbortError') {
    return 'Délai d’attente dépassé.';
  }
  if (err instanceof TypeError) {
    return 'Connexion à la source impossible.';
  }
  if (err instanceof Error) return err.message;
  return 'Erreur inconnue.';
}
