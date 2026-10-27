import { html, useEffect, useState } from '../lib/html.js';
import { useI18n } from '../lib/i18n.js';
import * as api from '../services/api.js';

export function CompanyFeedbackModal({ user, onClose }) {
  const { lang } = useI18n();
  const pt = lang === 'pt';
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy,onClose]);
  const submit = async (event) => {
    event.preventDefault();
    if (message.trim().length < 5) { setError(pt ? 'Escreva pelo menos 5 caracteres.' : 'Write at least 5 characters.');return; }
    setBusy(true);setError('');
    try { await api.sendCompanyFeedback(message.trim());setSent(true); }
    catch { setError(pt ? 'Não foi possível encaminhar a mensagem. Tente novamente.' : 'Could not queue your message. Please try again.'); }
    finally { setBusy(false); }
  };
  return html`<div class="modal-backdrop invite-modal-backdrop" onClick=${(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section class="modal invite-modal" role="dialog" aria-modal="true" aria-labelledby="company-feedback-title">
      <button type="button" class="modal-close" aria-label=${pt ? 'Fechar' : 'Close'} disabled=${busy} onClick=${onClose}>×</button>
      <div class="kicker">${pt ? 'FALE COM A EQUIPE' : 'CONTACT THE TEAM'}</div>
      <h2 class="form-title" id="company-feedback-title">${pt ? 'Dúvidas e sugestões' : 'Questions and suggestions'}</h2>
      ${sent ? html`<div class="notice" role="status">${pt ? 'Mensagem recebida e encaminhada para envio à equipe da Abiquifi.' : 'Message received and queued for delivery to the Abiquifi team.'}</div>
        <button type="button" class="btn btn-lime" onClick=${onClose}>${pt ? 'Fechar' : 'Close'}</button>`
      : html`<form onSubmit=${submit} class="company-feedback-form">
        <p class="form-subtitle">${pt ? 'Escreva sua mensagem. A equipe poderá responder para' : 'Write your message. The team can reply to'} <strong>${user.email}</strong>.</p>
        <label class="form-label" for="company-feedback-message">${pt ? 'Sua mensagem' : 'Your message'}</label>
        <textarea id="company-feedback-message" class="input input-sm" rows="7" maxLength="3000" required value=${message} onInput=${(event) => setMessage(event.target.value)}></textarea>
        <div class="form-help">${message.length}/3000</div>
        ${error && html`<div class="form-error" role="alert">${error}</div>`}
        <div class="invite-modal-actions"><button type="button" class="btn btn-outline" disabled=${busy} onClick=${onClose}>${pt ? 'Cancelar' : 'Cancel'}</button>
          <button type="submit" class="btn btn-lime" disabled=${busy}>${busy ? (pt ? 'Enviando...' : 'Sending...') : (pt ? 'Enviar mensagem' : 'Send message')}</button></div>
      </form>`}
    </section>
  </div>`;
}
