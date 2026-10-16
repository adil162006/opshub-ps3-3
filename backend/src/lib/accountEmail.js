import nodemailer from 'nodemailer';
import { AppError } from './AppError.js';

function createTransport() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM || user;
  if (!host || !from) throw new AppError(503, 'Email delivery is not configured');
  const port = Number(process.env.SMTP_PORT) || 587;
  return {
    from,
    transport: nodemailer.createTransport({
      host,
      port,
      secure: process.env.SMTP_SECURE === 'true' || port === 465,
      ...(user && pass ? { auth: { user, pass } } : {}),
    }),
  };
}

/** Send the account credentials to a newly created user or an access notice to an existing user. */
export async function sendAccountEmail({ name, email, password, memberships }) {
  const mailer = createTransport();
  const siteRoles = memberships.length
    ? memberships.map(({ siteName, role }) => `${siteName}: ${role}`).join('\n')
    : 'No site memberships have been assigned yet.';
  const credentials = password
    ? [`Initial password: ${password}`, '', 'Please change the initial password after signing in.']
    : ['Use your existing OpsHub password to sign in.'];
  await mailer.transport.sendMail({
    from: mailer.from,
    to: email,
    subject: 'Your OpsHub account and site access',
    text: [
      `Hello ${name},`,
      '',
      password
        ? 'An administrator created an OpsHub account for you.'
        : 'A site administrator added site access to your existing OpsHub account.',
      `Email: ${email}`,
      ...credentials,
      '',
      'Your site roles:',
      siteRoles,
    ].join('\n'),
  });
}
