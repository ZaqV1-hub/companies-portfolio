// Interface translations (i18n/en.json, i18n/pt.json) and the current language.
// The public site opens in English (spec 1, section 2); the choice is remembered per browser.
import { createContext, html, useContext, useEffect, useMemo, useState } from './html.js';

export const LANGS = ['en', 'pt'];
const LANG_KEY = 'cp.lang';
const dictionaries = {};

export async function loadDictionaries() {
  await Promise.all(LANGS.map(async (l) => {
    const res = await fetch('i18n/' + l + '.json');
    dictionaries[l] = await res.json();
  }));
}

function lookup(dict, key) {
  return key.split('.').reduce((node, part) => (node && node[part] !== undefined ? node[part] : undefined), dict);
}

/** Translates a key; {name} placeholders are replaced from vars. Missing keys show the key itself. */
export function translate(lang, key, vars) {
  let s = lookup(dictionaries[lang], key);
  if (s === undefined) s = lookup(dictionaries.en, key);
  if (s === undefined) {
    console.warn('[i18n] missing key', key);
    return key;
  }
  if (vars) Object.keys(vars).forEach((k) => { s = s.split('{' + k + '}').join(vars[k]); });
  return s;
}

/** Picks the right language of a free-text field stored as {pt, en}. Falls back to the other one. */
export function pick(lang, value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  return value[lang] || value[lang === 'en' ? 'pt' : 'en'] || '';
}

function initialLang() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (LANGS.includes(saved)) return saved;
  } catch (err) { /* storage blocked */ }
  return 'en';
}

const LangContext = createContext(null);

export function LangProvider({ children }) {
  const [lang, setLang] = useState(initialLang);
  useEffect(() => {
    document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en';
    try { localStorage.setItem(LANG_KEY, lang); } catch (err) { /* ignore */ }
  }, [lang]);
  const value = useMemo(() => ({
    lang,
    setLang,
    t: (key, vars) => translate(lang, key, vars),
    tx: (field) => pick(lang, field),
    // label of a closed-list value: label('markets', 'europe')
    label: (list, v) => translate(lang, 'enum.' + list + '.' + v),
  }), [lang]);
  return html`<${LangContext.Provider} value=${value}>${children}<//>`;
}

/** const { t, tx, label, lang, setLang } = useI18n(); */
export function useI18n() {
  return useContext(LangContext);
}
