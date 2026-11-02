import { html, useEffect, useRef } from '../lib/html.js';

export function ImageLightbox({ src, label, closeLabel, onClose }) {
  const close = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    close.current?.focus();
    const keydown = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key === 'Tab') { event.preventDefault(); close.current?.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', keydown);
      previous?.focus();
    };
  }, []);
  return window.ReactDOM.createPortal(html`<div class="product-lightbox" role="dialog" aria-modal="true" aria-label=${label}
    onClick=${(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <button ref=${close} class="product-lightbox-close" type="button" onClick=${onClose}>${closeLabel} ×</button>
    <img src=${src} alt=${label} />
  </div>`, document.body);
}
