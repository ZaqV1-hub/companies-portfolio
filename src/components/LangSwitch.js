// EN / PT selector. `dark` variant for the navy sidebar.
import { cx, html } from '../lib/html.js';
import { LANGS, useI18n } from '../lib/i18n.js';

function Flag({ lang }) {
  return lang === 'pt' ? html`<svg viewBox="0 0 24 16" aria-hidden="true" focusable="false">
    <rect width="24" height="16" fill="#229e45" /><path d="M12 2 22 8 12 14 2 8Z" fill="#ffdf00" />
    <circle cx="12" cy="8" r="3.7" fill="#002776" /><path d="M8.4 7.4c2.1-.5 4.9.1 7.1 1.7" fill="none" stroke="#fff" strokeWidth=".7" />
  </svg>` : html`<svg viewBox="0 0 24 16" aria-hidden="true" focusable="false">
    <rect width="24" height="16" fill="#012169" /><path d="M0 0 24 16M24 0 0 16" stroke="#fff" strokeWidth="3.4" />
    <path d="M0 0 24 16M24 0 0 16" stroke="#c8102e" strokeWidth="1.5" /><path d="M12 0v16M0 8h24" stroke="#fff" strokeWidth="5" />
    <path d="M12 0v16M0 8h24" stroke="#c8102e" strokeWidth="2.6" />
  </svg>`;
}

export function LangSwitch({ dark }) {
  const { lang, setLang, t } = useI18n();
  return html`
    <div class=${cx('lang-switch', dark && 'on-dark')} role="group" aria-label=${t('common.language')}>
      ${LANGS.map((l) => html`
        <button key=${l} type="button" aria-label=${t('common.lang_' + l)} aria-pressed=${lang === l} onClick=${() => setLang(l)}><${Flag} lang=${l} />${t('common.lang_' + l)}</button>`)}
    </div>`;
}
