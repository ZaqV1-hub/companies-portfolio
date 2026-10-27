import nodemailer from 'nodemailer';

export function mailAvailable() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_FROM && process.env.PUBLIC_ORIGIN);
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
    disableFileAccess:true, disableUrlAccess:true,
  });
}

export async function sendPlatformMail(to, { subject, title, intro, button, url, note, lang = 'pt', replyTo }) {
  const safeUrl = url?.startsWith(origin() + '/') ? url : null;
  const text = [title, intro, safeUrl ? `${button}: ${safeUrl}` : '', note].filter(Boolean).join('\n\n');
  const html = `<!doctype html><html lang="${lang === 'en' ? 'en' : 'pt-BR'}"><head><meta charset="UTF-8"></head><body style="margin:0;background:#f4f6f9;font-family:Arial,sans-serif;color:#14203d"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f9;padding:32px 12px"><tr><td align="center"><table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden"><tr><td style="background:#141d39;color:#cbea2b;padding:22px 32px;font-size:13px;font-weight:700;letter-spacing:1px">BRAZILIAN PHARMA &amp; HEALTH</td></tr><tr><td style="padding:32px"><h1 style="font-size:25px;line-height:1.25;margin:0 0 18px;color:#141d39">${esc(title)}</h1><p style="font-size:16px;line-height:1.6;white-space:pre-line;margin:0 0 24px">${esc(intro)}</p>${safeUrl ? `<table role="presentation" cellspacing="0" cellpadding="0"><tr><td style="background:#cbea2b;border-radius:8px"><a href="${esc(safeUrl)}" style="display:inline-block;padding:14px 24px;color:#141d39;font-size:15px;font-weight:700;text-decoration:none">${esc(button)}</a></td></tr></table>` : ''}${note ? `<p style="margin:25px 0 0;color:#667085;font-size:13px;line-height:1.5">${esc(note)}</p>` : ''}</td></tr></table></td></tr></table></body></html>`;
  await transport().sendMail({ from:process.env.SMTP_FROM, to, replyTo: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyTo || '') ? replyTo : undefined, subject, text, html });
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
