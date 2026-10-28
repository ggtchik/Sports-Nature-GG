/**
 * Amorçage commun aux tests d'intégration : charge `dist/index.html` et le
 * bundle construit, injecte les substitutions de navigateur manquantes
 * (ResizeObserver, matchMedia, IntersectionObserver…) et fournit des aides de
 * saisie / clic qui déclenchent réellement les gestionnaires React.
 */
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Chemin du bundle JS produit par `npm run build`. */
export function bundlePath() {
  const html = readFileSync(resolve(root, 'dist/index.html'), 'utf8');
  const m = html.match(/src="\.\/(assets\/[^"]+\.js)"/);
  if (!m) throw new Error('Bundle introuvable dans dist/index.html — lancez `npm run build`.');
  return resolve(root, 'dist', m[1]);
}

export async function boot({ routes = [], failUnmatched = true, offline = false } = {}) {
  const html = readFileSync(resolve(root, 'dist/index.html'), 'utf8');
  const js = readFileSync(bundlePath(), 'utf8');

  const errors = [];
  const dom = new JSDOM(html, {
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    url: 'http://localhost:5173/',
  });
  const { window } = dom;
  const { document } = window;

  window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  window.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
  window.matchMedia = (q) => ({
    matches: false, media: q,
    addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {},
  });
  window.confirm = () => true;
  window.scrollTo = () => {};

  if (offline) {
    window.fetch = async (u) => { throw new TypeError('Failed to fetch ' + String(u)); };
  } else {
    window.fetch = async (url) => {
      const u = String(url);
      for (const [re, make] of routes) {
        if (re.test(u)) {
          const body = JSON.stringify(make(u));
          return { ok: true, status: 200, url: u, text: async () => body, json: async () => JSON.parse(body) };
        }
      }
      if (u.includes('land-110m.json')) return { ok: false, status: 404, text: async () => '' };
      if (failUnmatched) throw new TypeError('Failed to fetch ' + u);
      return { ok: false, status: 404, text: async () => '' };
    };
  }

  window.addEventListener('error', (e) => errors.push(`window.error: ${e.message}`));
  const origError = console.error;
  console.error = (...a) => { errors.push(a.map(String).join(' ')); origError(...a); };

  window.eval(js);
  await new Promise((r) => setTimeout(r, 700));

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const txt = () => document.getElementById('root')?.textContent ?? '';
  const setNative = (el, v) => {
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new window.Event('input', { bubbles: true }));
  };
  const setField = (id, v) => { setNative(document.getElementById(id), v); };
  const clickText = (sel, needle) => {
    const el = $$(sel).find((x) => (x.textContent ?? '').includes(needle));
    if (!el) { console.log(`   [élément introuvable : ${sel} « ${needle} »]`); return false; }
    el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
    return true;
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const currentStep = () => $$('.stepper__item').findIndex((e) => e.getAttribute('aria-current') === 'step') + 1;

  return { window, document, $, $$, txt, setNative, setField, clickText, sleep, currentStep, errors };
}

/** Vérificateur minimal : compte les échecs et imprime le résultat. */
export function report(title, ok, errors = []) {
  console.log(ok ? `\n✅ ${title}` : `\n❌ ${title}`);
  errors.slice(0, 6).forEach((e) => console.log('   !', String(e).slice(0, 220)));
  process.exit(ok ? 0 : 1);
}
