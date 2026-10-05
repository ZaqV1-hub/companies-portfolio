// Small shared building blocks.
import { cx, html, useEffect, useRef, useState } from '../lib/html.js';
import { useI18n } from '../lib/i18n.js';

/** Long text: shows 3 lines and a "see more" toggle when it overflows (spec 1, 6.4). */
export function ReadMore({ text, className }) {
  const { t } = useI18n();
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || open) return undefined;
    const measure = () => setOverflows(el.scrollHeight > el.clientHeight + 1);
    measure();
    // re-measure after web fonts load and on resize (line breaks change)
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (document.fonts) document.fonts.ready.then(measure);
    return () => ro.disconnect();
  }, [text, open]);
  return html`
    <div>
      <p ref=${ref} class=${cx('prose', className, !open && 'clamp-3')}>${text}</p>
      ${(overflows || open) && html`
        <button type="button" class="see-more" onClick=${() => setOpen(!open)}>${open ? t('common.see_less') : t('common.see_more')}</button>`}
    </div>`;
}

export function Tags({ items, variant }) {
  if (!items || !items.length) return null;
  return html`<div class="tags">${items.map((s, i) => html`<span key=${i} class=${cx('tag', variant)}>${s}</span>`)}</div>`;
}

/** Logo on a plate, or the organization name as a wordmark when there is no logo. */
export function LogoPlate({ org, className }) {
  return org.logo_url
    ? html`<div class=${className}><img src=${org.logo_url} alt=${org.name} /></div>`
    : html`<div class=${cx(className, 'plain')}><div class="wordmark">${org.name}</div></div>`;
}
