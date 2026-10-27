import { html, useEffect, useRef, useState } from '../lib/html.js';
import { useI18n } from '../lib/i18n.js';
import * as api from '../services/api.js';

const TYPES = [
  ['question', 'Dúvida', 'Question'],
  ['suggestion', 'Sugestão', 'Suggestion'],
  ['profile_update', 'Atualizar meu perfil', 'Update my profile'],
  ['dashboard_issue', 'Problema no painel', 'Dashboard issue'],
];

export function CompanyFeedbackModal({ user, onClose }) {
  const { lang } = useI18n();
  const pt = lang === 'pt';
  const subjectRef = useRef(null);
  const [type, setType] = useState('question');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [replyEmail, setReplyEmail] = useState(user.email || '');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    subjectRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const submit = async (event) => {
    event.preventDefault();
    if (message.trim().length < 5) { setError(pt ? 'Escreva sua mensagem com pelo menos 5 caracteres.' : 'Write a message with at least 5 characters.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyEmail.trim())) { setError(pt ? 'Informe um e-mail válido para a resposta.' : 'Enter a valid reply email address.'); return; }
    setBusy(true); setError('');
    try { await api.sendCompanyFeedback({ type, subject:subject.trim(), message:message.trim(), replyEmail:replyEmail.trim() }); setSent(true); }
    catch { setError(pt ? 'Não foi possível encaminhar a mensagem. Tente novamente.' : 'Could not queue your message. Please try again.'); }
    finally { setBusy(false); }
  };

  return html`<div class="modal-backdrop company-feedback-backdrop" onClick=${(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section class="modal company-feedback-dialog" role="dialog" aria-modal="true" aria-labelledby="company-feedback-title">
      ${sent ? html`<div class="company-feedback-success" role="status">
        <span class="company-feedback-success-icon" aria-hidden="true">✓</span>
        <h2 id="company-feedback-title">${pt ? 'Mensagem encaminhada' : 'Message queued'}</h2>
        <p>${pt ? 'Sua mensagem foi recebida para envio à equipe da Abiquifi. O endereço indicado para resposta é' : 'Your message was queued for the Abiquifi team. The reply address is'} <strong>${replyEmail}</strong>.</p>
        <button type="button" class="btn btn-lime" onClick=${onClose}>${pt ? 'Voltar ao painel' : 'Back to dashboard'}</button>
      </div>` : html`
        <div class="company-feedback-head">
          <span class="company-feedback-icon" aria-hidden="true">?</span>
          <div><h2 id="company-feedback-title">${pt ? 'Fale com a equipe Abiquifi' : 'Contact the Abiquifi team'}</h2>
            <p>${pt ? 'Envie sua mensagem para a equipe do programa. A resposta chega no e-mail indicado abaixo.' : 'Send a message to the program team. Replies go to the email address below.'}</p></div>
          <button type="button" class="modal-close" aria-label=${pt ? 'Fechar' : 'Close'} disabled=${busy} onClick=${onClose}>×</button>
        </div>
        <form onSubmit=${submit} noValidate class="company-feedback-form">
          <fieldset class="company-feedback-fieldset"><legend>${pt ? 'Sobre o que é?' : 'What is this about?'}</legend>
            <div class="company-feedback-types">${TYPES.map(([value,ptLabel,enLabel]) => html`<button type="button" key=${value} aria-pressed=${type === value} disabled=${busy} onClick=${() => setType(value)}>${pt ? ptLabel : enLabel}</button>`)}</div>
          </fieldset>
          <label class="form-label" for="company-feedback-subject">${pt ? 'Assunto' : 'Subject'}</label>
          <input ref=${subjectRef} id="company-feedback-subject" class="input input-sm" maxLength="160" value=${subject} onInput=${(event) => setSubject(event.target.value)} placeholder=${pt ? 'Ex.: Como incluir um novo produto no pipeline' : 'E.g. How do I add a new product to the pipeline?'} />
          <label class="form-label" for="company-feedback-message">${pt ? 'Mensagem' : 'Message'}</label>
          <textarea id="company-feedback-message" class="input input-sm" rows="5" maxLength="2000" value=${message} onInput=${(event) => { setMessage(event.target.value); if (error) setError(''); }} placeholder=${pt ? 'Escreva sua dúvida ou sugestão' : 'Write your question or suggestion'}></textarea>
          <div class="company-feedback-count">${message.length}/2000</div>
          <label class="form-label" for="company-feedback-reply">${pt ? 'Responder para' : 'Reply to'}</label>
          <input id="company-feedback-reply" class="input input-sm" type="email" value=${replyEmail} onInput=${(event) => { setReplyEmail(event.target.value); if (error) setError(''); }} />
          ${error && html`<div class="form-error" role="alert">${error}</div>`}
          <div class="company-feedback-actions"><button type="button" class="btn btn-outline" disabled=${busy} onClick=${onClose}>${pt ? 'Cancelar' : 'Cancel'}</button>
            <button type="submit" class="btn btn-lime" disabled=${busy}>${busy ? (pt ? 'Enviando...' : 'Sending...') : (pt ? 'Enviar mensagem' : 'Send message')}</button></div>
        </form>`}
    </section>
  </div>`;
}
