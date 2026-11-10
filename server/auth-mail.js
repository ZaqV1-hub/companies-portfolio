import nodemailer from 'nodemailer';
import { readFile } from 'node:fs/promises';

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
  const font = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;";
  const lines = (value) => esc(value).replace(/\r?\n/g, '<br />');
  const paragraphs = (value) => String(value || '').split(/\r?\n\s*\r?\n/).filter(Boolean).map((part)=>`<p style="${font}font-size:15px;line-height:24px;margin:0 0 18px;color:#344054;">${lines(part)}</p>`).join('');
  const details = fields.filter(([,value])=>value !== undefined && value !== null && value !== '');
  const text = [title,intro,details.map(([label,value])=>`${label}: ${value}`).join('\n'),message ? `${messageLabel || (lang === 'en' ? 'Message' : 'Mensagem')}\n${message}` : '',safeUrl ? `${button}: ${safeUrl}` : '',note].filter(Boolean).join('\n\n');
  const html = `<!doctype html>
<html lang="${lang === 'en' ? 'en' : 'pt-BR'}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<!--[if mso]><style>body,table,td,p,a,h1,strong{font-family:'Segoe UI',Helvetica,Arial,sans-serif !important;}</style><![endif]-->
<style>@media only screen and (max-width:600px){.email-pad{padding-left:24px !important;padding-right:24px !important}.email-title{font-size:25px !important;line-height:33px !important}.email-outer{padding:16px 8px !important}}</style>
</head>
<body style="margin:0;padding:0;background:#f1f4f8;${font}">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f1f4f8"><tr>
<td align="center" class="email-outer" style="padding:36px 12px;${font}">
<!--[if mso]><table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" bgcolor="#ffffff" style="width:100%;max-width:600px;border:1px solid #e2e7ef;border-radius:18px;overflow:hidden;">
<tr><td height="5" bgcolor="#cbea2b" style="height:5px;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td class="email-pad" bgcolor="#141d39" style="padding:28px 36px;${font}">
<img src="cid:bph-logo@companiesportfolio" width="180" alt="Brazilian Pharma &amp; Health" style="display:block;width:180px;max-width:100%;height:auto;border:0;color:#ffffff;font-size:16px;" />
</td></tr>
<tr><td class="email-pad" style="${font}padding:32px 36px 12px;">
<h1 class="email-title" style="${font}font-size:28px;line-height:36px;font-weight:600;margin:0 0 24px;color:#171717;">${esc(title)}</h1>
${paragraphs(intro)}
${details.length ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 24px;">${details.map(([label,value])=>`<tr><td style="${font}padding:12px 0;border-bottom:1px solid #e4e7ec;font-size:14px;line-height:23px;color:#344054;"><strong>${esc(label)}</strong><br />${lines(value)}</td></tr>`).join('')}</table>` : ''}
${message ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f4f6f9" style="margin:0 0 24px;border-left:3px solid #cbea2b;"><tr><td style="${font}padding:20px;font-size:15px;line-height:25px;color:#344054;word-break:break-word;"><strong>${esc(messageLabel || (lang === 'en' ? 'Message' : 'Mensagem'))}</strong><br /><br />${lines(message)}</td></tr></table>` : ''}
${safeUrl ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:10px 0 24px;"><tr><td bgcolor="#cbea2b" style="${font}border-radius:8px;mso-padding-alt:16px 24px;"><a href="${esc(safeUrl)}" style="${font}display:inline-block;padding:16px 24px;color:#141d39;font-size:15px;line-height:22px;font-weight:bold;text-decoration:none;">${esc(button)}</a></td></tr></table>` : ''}
</td></tr>
${note ? `<tr><td class="email-pad" bgcolor="#f8fafc" style="${font}padding:24px 36px 8px;border-top:1px solid #edf0f5;">${paragraphs(note)}</td></tr>` : ''}
<tr><td class="email-pad" bgcolor="#ffffff" style="padding:28px 36px;border-top:1px solid #e4e7ec;">
<img src="cid:brand-signature@companiesportfolio" width="528" alt="Realização: BP&amp;H. Promovido por: ApexBrasil e Abiquifi." style="display:block;width:100%;max-width:528px;height:auto;border:0;${font}color:#344054;font-size:12px;line-height:20px;" />
</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;"><tr><td align="center" style="${font}padding:20px 12px;color:#667085;font-size:12px;line-height:20px;">Companies Portfolio &middot; Abiquifi<br />Brazilian Pharma &amp; Health</td></tr></table>
</td></tr></table>
</body></html>`;
  return { text, html };
}

export async function sendPlatformMail(to, options) {
  const { subject, replyTo } = options;
  const { text, html } = renderPlatformMail(options);
  const attachments = await Promise.all([
    ['bph-logo.png', 'bph-logo@companiesportfolio'],
    ['brand-signature.png', 'brand-signature@companiesportfolio'],
  ].map(async ([filename, cid]) => ({ filename, cid, content:await readFile(new URL('./mail-assets/' + filename, import.meta.url)), contentType:'image/png', contentDisposition:'inline' })));
  const testRedirect = String(process.env.EMAIL_TEST_REDIRECT || '').trim();
  if (testRedirect && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testRedirect)) throw new Error('Invalid EMAIL_TEST_REDIRECT');
  const responseAddress = replyTo || process.env.TEAM_NOTIFICATION_EMAIL || 'investment@abiquifi.org.br';
  await transport().sendMail({ from:process.env.SMTP_FROM, to:testRedirect || to,
    replyTo: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(responseAddress) ? responseAddress : undefined, subject, text, html, attachments });
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
