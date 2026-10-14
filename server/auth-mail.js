import nodemailer from 'nodemailer';

export function mailAvailable() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_FROM && process.env.PUBLIC_ORIGIN);
}

export async function sendAuthMail(to, kind, token) {
  if (!mailAvailable()) throw new Error('SMTP is not configured');
  const port = Number(process.env.SMTP_PORT);
  if (!Number.isInteger(port) || ![465, 587].includes(port)) throw new Error('Invalid SMTP port');
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  const base = process.env.PUBLIC_ORIGIN.replace(/\/$/, '');
  const verify = kind === 'verify';
  const url = `${base}/${verify ? 'verify-email' : 'reset-password'}?token=${encodeURIComponent(token)}`;
  const subject = verify ? 'Confirme seu e-mail | Companies Portfolio' : 'Redefina sua senha | Companies Portfolio';
  const text = verify
    ? `Para confirmar seu e-mail no Companies Portfolio, abra este link em até 24 horas:\n${url}\n\nSe você não pediu o cadastro, ignore esta mensagem.`
    : `Para redefinir sua senha no Companies Portfolio, abra este link em até 1 hora:\n${url}\n\nSe você não fez este pedido, ignore esta mensagem.`;
  await transport.sendMail({ from: process.env.SMTP_FROM, to, subject, text });
}
