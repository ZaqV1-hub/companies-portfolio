import { html, useEffect, useRef, useState } from '../lib/html.js';

// CRM filters use the same visual language as the dashboard rather than the browser's native menu.
export function FilterSelect({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event) => { if (event.key === 'Escape' || (event.type === 'pointerdown' && !root.current?.contains(event.target))) setOpen(false); };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', dismiss);
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', dismiss); };
  }, [open]);
  const selected = options.find((option) => option.value === value) || options[0];
  return html`<div class="crm-filter" ref=${root}>
    <span class="crm-filter-label">${label}</span>
    <button type="button" class="crm-filter-trigger" aria-haspopup="listbox" aria-expanded=${open}
      onClick=${() => setOpen(!open)}>${selected?.name || ''}<span aria-hidden="true">⌄</span></button>
    ${open && html`<div class="crm-filter-menu" role="listbox" aria-label=${label}>
      ${options.map((option) => html`<button key=${option.value} type="button" role="option" aria-selected=${option.value === value}
        class=${option.value === value ? 'selected' : ''} onClick=${() => { onChange(option.value); setOpen(false); }}>${option.name}</button>`)}
    </div>`}
  </div>`;
}
