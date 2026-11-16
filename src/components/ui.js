// Small shared building blocks.
import { cx, html, useEffect, useRef, useState } from '../lib/html.js';
import { useI18n } from '../lib/i18n.js';

export function shortenText(text, limit) {
  const value = text.trim();
  if (value.length <= limit) return value;
  const preview = value.slice(0, limit - 1);
  const boundary = preview.search(/\s+\S*$/);
  return (boundary >= limit * .7 ? preview.slice(0, boundary) : preview).trimEnd() + '…';
}

/** Keeps long prose compact by character count and by available space. */
export function ReadMore({ text, className, limit = 280 }) {
  const { t } = useI18n();
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const preview = shortenText(text, limit);
  const shortened = preview !== text.trim();
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
      <p ref=${ref} class=${cx('prose', className, !open && 'clamp-3')}>${open ? text : preview}</p>
      ${(shortened || overflows || open) && html`
        <button type="button" class="see-more" aria-expanded=${open} onClick=${() => setOpen(!open)}>${open ? t('profile.read_less') : t('profile.read_more')}</button>`}
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
