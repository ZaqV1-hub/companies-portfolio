import { html, useEffect, useState } from '../../lib/html.js';
import * as api from '../../services/api.js?v=20261026-company-invite1';
import { useI18n } from '../../lib/i18n.js';
import { navigate } from '../../lib/router.js';

export function InvitationPage({ token, onLoggedIn }) {
  const { lang,t } = useI18n();
  const pt = lang === 'pt';
  const [invitation,setInvitation] = useState(null);
  const [error,setError] = useState('');
  const [name,setName] = useState('');
  const [password,setPassword] = useState('');
  const [confirm,setConfirm] = useState('');
  const [touched,setTouched] = useState({});
  const [submitted,setSubmitted] = useState(false);
  const [busy,setBusy] = useState(false);
  useEffect(() => { api.getCompanyInvitation(token).then(setInvitation).catch(() => setError(pt ? 'Este convite expirou ou já foi utilizado.' : 'This invitation has expired or has already been used.')); }, [token]);
  const rules = [
    ['password_rule_length', password.length >= 10 && password.length <= 128],
    ['password_rule_upper', /\p{Lu}/u.test(password)],
    ['password_rule_lower', /\p{Ll}/u.test(password)],
    ['password_rule_number', /\d/.test(password)],
  ];
  const errors = {
    name:name.trim().length >= 2 && name.trim().length <= 200 ? '' : t('investor.field_required'),
    password:rules.every(([,met]) => met) ? '' : t('investor.password_requirements'),
    confirm:!confirm ? t('investor.field_required') : confirm === password ? '' : t('investor.password_mismatch'),
  };
  const visible = (field) => (touched[field] || submitted) ? errors[field] : '';
  const valid = (field) => Boolean((touched[field] || submitted) && !errors[field] && (field === 'name' ? name : field === 'password' ? password : confirm));
  const touch = (field) => setTouched((current) => ({ ...current,[field]:true }));
  const submit = async (event) => {
    event.preventDefault(); setSubmitted(true); setError('');
    if (Object.values(errors).some(Boolean)) return;
    setBusy(true);
    try {
      const result = await api.acceptCompanyInvitation({ token,name:name.trim(),password,confirm_password:confirm });
      if (result.ok) { onLoggedIn(result.user); navigate('/company/profile'); }
    } catch (e) { setError(e.message === 'email_has_account' ? (pt ? 'Este e-mail já tem uma conta. Entre com sua senha.' : 'This email already has an account. Sign in with your password.') : (pt ? 'Não foi possível criar o acesso. Confira os dados e tente novamente.' : 'Could not create your account. Check the details and try again.')); }
    finally { setBusy(false); }
  };
  return html`<div class="split"><div class="split-brand invitation-brand"><div class="invitation-brand-logo"><img src="assets/img/bph-logo.png" alt="Brazilian Pharma & Health" /></div><div><h2>${pt ? 'Seu perfil no portfólio' : 'Your portfolio profile'}</h2><p>${pt ? 'Confira as informações da empresa e publique seu perfil.' : 'Review your company information and publish your profile.'}</p></div></div>
    <div class="split-form"><form class="split-form-inner" noValidate=${true} onSubmit=${submit}>
      <div class="kicker">${pt ? 'CONVITE DA EMPRESA' : 'COMPANY INVITATION'}</div>
      <h1 class="form-title">${pt ? 'Crie seu acesso' : 'Create your account'}</h1>
      ${invitation ? html`<p class="form-subtitle">${invitation.name}</p><div class="stack">
        <label><span class="field-label">${pt ? 'E-mail' : 'Email'}</span><input class="input input-sm" value=${invitation.email} disabled /></label>
        <label class=${`auth-field${visible('name') ? ' has-error' : ''}${valid('name') ? ' is-valid' : ''}`}><span class="field-label">${pt ? 'Seu nome' : 'Your name'} *</span><input class="input input-sm" autocomplete="name" aria-invalid=${Boolean(visible('name'))} value=${name} onInput=${(e) => setName(e.target.value)} onBlur=${() => touch('name')} />${visible('name') && html`<small class="field-error" role="status">${visible('name')}</small>`}</label>
        <label class=${`auth-field${visible('password') ? ' has-error' : ''}${valid('password') ? ' is-valid' : ''}`}><span class="field-label">${pt ? 'Criar senha' : 'Create password'} *</span><input class="input input-sm" type="password" autocomplete="new-password" aria-invalid=${Boolean(visible('password'))} value=${password} onInput=${(e) => setPassword(e.target.value)} onFocus=${() => touch('password')} />
          <ul class="auth-password-rules">${rules.map(([key,met]) => html`<li key=${key} class=${met ? 'met' : touched.password || submitted ? 'unmet' : ''}>${t('investor.' + key)}</li>`)}</ul>${visible('password') && html`<small class="field-error" role="status">${visible('password')}</small>`}</label>
        <label class=${`auth-field${visible('confirm') ? ' has-error' : ''}${valid('confirm') ? ' is-valid' : ''}`}><span class="field-label">${pt ? 'Confirmar senha' : 'Confirm password'} *</span><input class="input input-sm" type="password" autocomplete="new-password" aria-invalid=${Boolean(visible('confirm'))} value=${confirm} onInput=${(e) => { setConfirm(e.target.value); touch('confirm'); }} onBlur=${() => touch('confirm')} />${visible('confirm') && html`<small class="field-error" role="status">${visible('confirm')}</small>`}</label>
        ${error && html`<div class="form-error" role="alert">${error}</div>`}
        <button class="btn btn-lime btn-xl" type="submit" disabled=${busy}>${pt ? 'Criar conta e revisar perfil' : 'Create account and review profile'}</button>
      </div>` : html`<p class="form-subtitle">${error || (pt ? 'Carregando convite...' : 'Loading invitation...')}</p>`}
    </form></div></div>`;
}
