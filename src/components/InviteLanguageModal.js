import { html, useEffect, useState } from '../lib/html.js';
import { useI18n } from '../lib/i18n.js';

export function InviteLanguageModal({ email, busy, error, onClose, onConfirm }) {
  const { lang } = useI18n();
  const pt = lang === 'pt';
  const [selected, setSelected] = useState(lang === 'en' ? 'en' : 'pt');
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy,onClose]);
  return html`<div class="modal-backdrop invite-modal-backdrop" onClick=${(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section class="modal invite-modal" role="dialog" aria-modal="true" aria-labelledby="invite-language-title">
      <button class="modal-close" type="button" aria-label=${pt ? 'Fechar' : 'Close'} disabled=${busy} onClick=${onClose}>×</button>
      <div class="kicker">${pt ? 'CONVITE DA EMPRESA' : 'COMPANY INVITATION'}</div>
      <h2 class="form-title" id="invite-language-title">${pt ? 'Escolha o idioma do convite' : 'Choose the invitation language'}</h2>
      <p class="form-subtitle">${pt ? 'O e-mail será enviado para' : 'The email will be sent to'} <strong>${email}</strong>.</p>
      <div class="invite-language-options" role="radiogroup" aria-label=${pt ? 'Idioma do e-mail' : 'Email language'}>
        ${[['pt','Português'],['en','English']].map(([code,label]) => html`<label class=${'invite-language-option' + (selected === code ? ' selected' : '')} key=${code}>
          <input type="radio" name="invite-language" value=${code} checked=${selected === code} onChange=${() => setSelected(code)} disabled=${busy} />
          <span><strong>${label}</strong><small>${code === 'pt' ? (pt ? 'E-mail e criação da conta em português' : 'Email and account creation in Portuguese') : (pt ? 'E-mail e criação da conta em inglês' : 'Email and account creation in English')}</small></span>
        </label>`)}</div>
      ${error && html`<div class="form-error" role="alert">${error}</div>`}
      <div class="invite-modal-actions"><button type="button" class="btn btn-outline" disabled=${busy} onClick=${onClose}>${pt ? 'Cancelar' : 'Cancel'}</button>
        <button type="button" class="btn btn-lime btn-lg" disabled=${busy || !email} onClick=${() => onConfirm(selected)}>${busy ? (pt ? 'Preparando convite...' : 'Preparing invitation...') : (pt ? 'Enviar convite' : 'Send invitation')}</button></div>
    </section>
  </div>`;
}
