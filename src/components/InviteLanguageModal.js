import { html, useState } from '../lib/html.js';
import { useI18n } from '../lib/i18n.js';
import { EditorDialog } from './form/EditorDialog.js?v=202611-profile-modals1';

export function InviteLanguageModal({ email, busy, error, onClose, onConfirm }) {
  const { lang } = useI18n();
  const pt = lang === 'pt';
  const [selected, setSelected] = useState(lang === 'en' ? 'en' : 'pt');
  return html`<${EditorDialog} title=${pt ? 'Escolha o idioma do convite' : 'Choose the invitation language'}
    description=${html`${pt ? 'O e-mail será enviado para' : 'The email will be sent to'} <strong>${email}</strong>.`}
    action=${busy ? (pt ? 'Preparando convite...' : 'Preparing invitation...') : (pt ? 'Enviar convite' : 'Send invitation')}
    onClose=${onClose} onConfirm=${() => onConfirm(selected)} busy=${busy} confirmDisabled=${!email}>
      <div class="invite-language-options" role="radiogroup" aria-label=${pt ? 'Idioma do e-mail' : 'Email language'}>
        ${[['pt','Português'],['en','English']].map(([code,label]) => html`<label class=${'invite-language-option' + (selected === code ? ' selected' : '')} key=${code}>
          <input type="radio" name="invite-language" value=${code} checked=${selected === code} onChange=${() => setSelected(code)} disabled=${busy} />
          <span><strong>${label}</strong><small>${code === 'pt' ? (pt ? 'E-mail e criação da conta em português' : 'Email and account creation in Portuguese') : (pt ? 'E-mail e criação da conta em inglês' : 'Email and account creation in English')}</small></span>
        </label>`)}</div>
      ${error && html`<div class="form-error" role="alert">${error}</div>`}
  <//>`;
}
