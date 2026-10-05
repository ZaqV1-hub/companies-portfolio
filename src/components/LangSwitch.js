// EN / PT selector. `dark` variant for the navy sidebar.
import { cx, html } from '../lib/html.js';
import { LANGS, useI18n } from '../lib/i18n.js';

export function LangSwitch({ dark }) {
  const { lang, setLang, t } = useI18n();
  return html`
    <div class=${cx('lang-switch', dark && 'on-dark')} role="group" aria-label=${t('common.language')}>
      ${LANGS.map((l) => html`
        <button key=${l} type="button" aria-pressed=${lang === l} onClick=${() => setLang(l)}>${t('common.lang_' + l)}</button>`)}
    </div>`;
}
