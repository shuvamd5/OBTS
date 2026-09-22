import nodemailer from 'nodemailer';
import { config } from '../config/env.js';

const { host, port, secure, user, pass, from } = config.mail;
export const mailEnabled = Boolean(host && user);

let transporter = null;
if (mailEnabled) {
  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user ? { user, pass } : undefined,
  });
}

// Best-effort: with SMTP configured the reset link is emailed; otherwise it is
// logged so the flow keeps working in dev/test with no mail server.
export async function sendResetPasswordEmail({ to, uname, resetUrl }) {
  const text =
    `Hi ${uname},\n\n` +
    `We received a request to reset your eYatra password. ` +
    `Click the link below to choose a new one:\n\n${resetUrl}\n\n` +
    `The link is valid for 1 hour. If you did not ask for this, you can ignore this email.\n`;

  if (!mailEnabled || !transporter) {
    console.log('\n[FORGOT-PASSWORD] Reset link for', to, ':', resetUrl, '\n');
    return { delivered: false, logged: true };
  }

  await transporter.sendMail({
    from: from || (user ? `${user}` : undefined),
    to,
    subject: 'eYatra - Reset your password',
    text,
    html:
      `<p>Hi <b>${uname}</b>,</p>` +
      `<p>We received a request to reset your eYatra password. Click the link below to choose a new one:</p>` +
      `<p><a href="${resetUrl}">Reset your password</a></p>` +
      `<p>The link is valid for 1 hour. If you did not ask for this, you can ignore this email.</p>`,
  });
  return { delivered: true, logged: false };
}