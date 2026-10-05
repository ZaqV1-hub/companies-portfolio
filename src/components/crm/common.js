// Shared pieces of the contacts registry: Lead/NIA/NPIA help (spec 2, section 3), classification badge.
import { cx, html, useState } from '../../lib/html.js';
import { useI18n } from '../../lib/i18n.js';
import { classificationView } from '../../lib/crm.js';

/** Collapsible "What are Lead, NIA and NPIA" block, with the exact text of spec 2, section 3 (PT and EN). */
export function HelpBlock() {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const npiaTypes = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  return html`<section class=${cx('help-block', open && 'open')}>
    <button type="button" class="help-toggle" aria-expanded=${open} onClick=${() => setOpen(!open)}>
      <span class="help-i">?</span> ${t('help.title')} <span class="chev">${open ? '▴' : '▾'}</span>
    </button>
    ${open && html`<div class="help-body">
      <p>${t('help.intro')}</p>
      <div class="help-card"><strong>${t('help.lead_title')}</strong><p>${t('help.lead')}</p><p><b>${t('help.what_company_does')}</b> ${t('help.lead_do')}</p></div>
      <div class="help-card"><strong>${t('help.nia_title')}</strong><p>${t('help.nia')}</p><p><b>${t('help.what_company_does')}</b> ${t('help.nia_do')}</p></div>
      <div class="help-card"><strong>${t('help.npia_title')}</strong><p>${t('help.npia')}</p>
        ${lang === 'pt' && html`<ul>${npiaTypes.map((k) => html`<li key=${k}>${t('enum.npia_types.' + k)};</li>`)}</ul>`}
        <p><b>${t('help.what_company_does')}</b> ${t('help.npia_do')}</p></div>
      <p><b>${t('help.br')}</b> ${t('help.br_text')}</p>
    </div>`}
  </section>`;
}

/** Help icon next to a classification: shows the short definition on hover/focus/click. */
export function HelpIcon({ value }) {
  const { t } = useI18n();
  const [show, setShow] = useState(false);
  const text = t('help.' + value + '_short');
  return html`<span class="help-icon-wrap">
    <button type="button" class="help-i small" aria-label=${text} title=${text} onClick=${(e) => { e.preventDefault(); e.stopPropagation(); setShow(!show); }}
      onBlur=${() => setShow(false)}>?</button>
    ${show && html`<span class="help-pop" role="tooltip">${text}</span>`}
  </span>`;
}

/** Validated classification + pending suggestion state. */
export function ClassificationBadge({ rel, withHelp = true }) {
  const { t, label } = useI18n();
  const v = classificationView(rel);
  return html`<span class="class-wrap">
    <span class=${'class-badge c-' + v.value}>${label('classification', v.value)}</span>
    ${withHelp && html`<${HelpIcon} value=${v.value} />`}
    ${v.state === 'suggested' && html`<span class="class-pending">→ ${label('classification', v.suggested)} · ${t('crm.awaiting')}</span>`}
  </span>`;
}

export function CompletenessBar({ c }) {
  return html`<span class="completeness" title=${c.filled + '/' + c.total}>
    <span class="completeness-bar"><span style=${{ width: c.pct + '%' }} class=${c.pct < 50 ? 'low' : c.pct < 100 ? 'mid' : 'full'}></span></span>
    <span class="completeness-pct">${c.pct}%</span>
  </span>`;
}
