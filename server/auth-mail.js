import nodemailer from 'nodemailer';

export function mailAvailable() {
  const official = 'investment@abiquifi.org.br';
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.PUBLIC_ORIGIN && process.env.SMTP_PASSWORD
    && String(process.env.SMTP_FROM || '').trim().toLowerCase() === official
    && String(process.env.SMTP_USER || '').trim().toLowerCase() === official);
}

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
const origin = () => process.env.PUBLIC_ORIGIN.replace(/\/$/, '');

function transport() {
  if (!mailAvailable()) throw new Error('SMTP is not configured');
  const port = Number(process.env.SMTP_PORT);
  if (!Number.isInteger(port) || ![465, 587].includes(port)) throw new Error('Invalid SMTP port');
  return nodemailer.createTransport({
    host:process.env.SMTP_HOST, port, secure:port === 465, requireTLS:port === 587,
    auth:process.env.SMTP_USER ? { user:process.env.SMTP_USER, pass:process.env.SMTP_PASSWORD } : undefined,
    connectionTimeout:20000, greetingTimeout:20000, socketTimeout:30000,
    disableFileAccess:true, disableUrlAccess:true,
  });
}

export function renderPlatformMail({ title, intro, button, url, note, lang = 'pt', fields = [], message, messageLabel }) {
  const safeUrl = url?.startsWith(origin() + '/') ? url : null;
  const font = 'font-family:Arial,Helvetica,sans-serif;';
  const lines = (value) => esc(value).replace(/\r?\n/g, '<br />');
  const paragraphs = (value) => String(value || '').split(/\r?\n\s*\r?\n/).filter(Boolean).map((part)=>`<p style="${font}font-size:15px;line-height:24px;margin:0 0 18px;color:#344054;">${lines(part)}</p>`).join('');
  const details = fields.filter(([,value])=>value !== undefined && value !== null && value !== '');
  const text = [title,intro,details.map(([label,value])=>`${label}: ${value}`).join('\n'),message ? `${messageLabel || (lang === 'en' ? 'Message' : 'Mensagem')}\n${message}` : '',safeUrl ? `${button}: ${safeUrl}` : '',note].filter(Boolean).join('\n\n');
  const html = `<!doctype html><html lang="${lang === 'en' ? 'en' : 'pt-BR'}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f4f6f9;${font}"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f4f6f9"><tr><td align="center" style="padding:28px 12px;${font}"><table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" bgcolor="#ffffff" style="width:100%;max-width:560px;border:1px solid #e4e7ec;border-radius:16px;"><tr><td bgcolor="#141d39" style="${font}color:#cbea2b;padding:22px 28px;font-size:12px;line-height:18px;font-weight:bold;letter-spacing:1px;">BRAZILIAN PHARMA &amp; HEALTH</td></tr><tr><td style="${font}padding:28px;"><h1 style="${font}font-size:24px;line-height:32px;font-weight:bold;margin:0 0 20px;color:#141d39;">${esc(title)}</h1>${paragraphs(intro)}${details.length ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:4px 0 24px;">${details.map(([label,value])=>`<tr><td style="${font}padding:10px 0;border-bottom:1px solid #e4e7ec;font-size:14px;line-height:22px;color:#344054;"><strong>${esc(label)}</strong><br />${lines(value)}</td></tr>`).join('')}</table>` : ''}${message ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f4f6f9" style="margin:0 0 24px;"><tr><td style="${font}padding:18px;font-size:15px;line-height:24px;color:#344054;word-break:break-word;"><strong>${esc(messageLabel || (lang === 'en' ? 'Message' : 'Mensagem'))}</strong><br /><br />${lines(message)}</td></tr></table>` : ''}${safeUrl ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td bgcolor="#cbea2b" style="${font}border-radius:8px;mso-padding-alt:14px 24px;"><a href="${esc(safeUrl)}" style="${font}display:inline-block;padding:14px 24px;color:#141d39;font-size:14px;line-height:20px;font-weight:bold;text-decoration:none;">${esc(button)}</a></td></tr></table>` : ''}${note ? `<div style="padding-top:22px;">${paragraphs(note)}</div>` : ''}</td></tr><tr><td style="${font}padding:18px 28px;border-top:1px solid #e4e7ec;color:#667085;font-size:12px;line-height:18px;">Companies Portfolio · Abiquifi</td></tr></table></td></tr></table></body></html>`;
  return { text, html };
}

export async function sendPlatformMail(to, options) {
  const { subject, replyTo } = options;
  const { text, html } = renderPlatformMail(options);
  const testRedirect = String(process.env.EMAIL_TEST_REDIRECT || '').trim();
  if (testRedirect && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testRedirect)) throw new Error('Invalid EMAIL_TEST_REDIRECT');
  const responseAddress = replyTo || process.env.TEAM_NOTIFICATION_EMAIL || 'investment@abiquifi.org.br';
  await transport().sendMail({ from:process.env.SMTP_FROM, to:testRedirect || to,
    replyTo: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(responseAddress) ? responseAddress : undefined, subject, text, html });
}

export async function sendAuthMail(to, kind, token) {
  const verify = kind === 'verify';
  const url = `${origin()}/${verify ? 'verify-email' : 'reset-password'}?token=${encodeURIComponent(token)}`;
  await sendPlatformMail(to, verify ? {
    subject:'Confirme seu e-mail | Companies Portfolio', title:'Confirme seu e-mail',
    intro:'Clique no botão para confirmar sua conta de investidor. Este acesso expira em 24 horas.',
    button:'Confirmar e-mail', url, note:'Se você não criou esta conta, ignore esta mensagem.',
  } : {
    subject:'Redefina sua senha | Companies Portfolio', title:'Redefina sua senha',
    intro:'Clique no botão para escolher uma nova senha. Este acesso expira em 1 hora.',
    button:'Redefinir senha', url, note:'Se você não fez este pedido, ignore esta mensagem.',
  });
}
