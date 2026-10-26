import { html, useEffect, useState } from '../../lib/html.js';
import * as api from '../../services/api.js?v=20261026-company-invite1';
import { useI18n } from '../../lib/i18n.js';
import { navigate } from '../../lib/router.js';

export function InvitationPage({ token, onLoggedIn }) {
  const { lang } = useI18n();
  const pt = lang === 'pt';
  const [invitation,setInvitation] = useState(null);
  const [error,setError] = useState('');
  const [name,setName] = useState('');
  const [password,setPassword] = useState('');
  const [confirm,setConfirm] = useState('');
  const [busy,setBusy] = useState(false);
  useEffect(() => { api.getCompanyInvitation(token).then(setInvitation).catch(() => setError(pt ? 'Este convite expirou ou já foi utilizado.' : 'This invitation has expired or has already been used.')); }, [token]);
  const submit = async (event) => {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const result = await api.acceptCompanyInvitation({ token,name,password,confirm_password:confirm });
      if (result.ok) { onLoggedIn(result.user); navigate('/company/profile'); }
    } catch (e) { setError(e.message === 'email_has_account' ? (pt ? 'Este e-mail já tem uma conta. Entre com sua senha.' : 'This email already has an account. Sign in with your password.') : (pt ? 'Não foi possível criar o acesso. Confira os dados e tente novamente.' : 'Could not create your account. Check the details and try again.')); }
    finally { setBusy(false); }
  };
  return html`<div class="split"><div class="split-brand"><img src="assets/img/bph-logo.png" alt="Brazilian Pharma & Health" /><div><h2>${pt ? 'Seu perfil no portfólio' : 'Your portfolio profile'}</h2><p>${pt ? 'Confira as informações da empresa e publique seu perfil.' : 'Review your company information and publish your profile.'}</p></div></div>
    <div class="split-form"><form class="split-form-inner" onSubmit=${submit}>
      <div class="kicker">${pt ? 'CONVITE DA EMPRESA' : 'COMPANY INVITATION'}</div>
      <h1 class="form-title">${pt ? 'Crie seu acesso' : 'Create your account'}</h1>
      ${invitation ? html`<p class="form-subtitle">${invitation.name}</p><div class="stack">
        <label><span class="field-label">${pt ? 'E-mail' : 'Email'}</span><input class="input input-sm" value=${invitation.email} disabled /></label>
        <label><span class="field-label">${pt ? 'Seu nome' : 'Your name'}</span><input class="input input-sm" required minLength="2" maxLength="200" value=${name} onInput=${(e) => setName(e.target.value)} /></label>
        <label><span class="field-label">${pt ? 'Criar senha' : 'Create password'}</span><input class="input input-sm" type="password" required minLength="10" maxLength="128" value=${password} onInput=${(e) => setPassword(e.target.value)} /></label>
        <label><span class="field-label">${pt ? 'Confirmar senha' : 'Confirm password'}</span><input class="input input-sm" type="password" required value=${confirm} onInput=${(e) => setConfirm(e.target.value)} /></label>
        ${confirm && confirm !== password && html`<div class="form-error">${pt ? 'As senhas precisam ser iguais.' : 'Passwords must match.'}</div>`}
        ${error && html`<div class="form-error" role="alert">${error}</div>`}
        <button class="btn btn-lime btn-xl" type="submit" disabled=${busy || password !== confirm}>${pt ? 'Criar conta e revisar perfil' : 'Create account and review profile'}</button>
      </div>` : html`<p class="form-subtitle">${error || (pt ? 'Carregando convite...' : 'Loading invitation...')}</p>`}
    </form></div></div>`;
}
