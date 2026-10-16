import nodemailer from 'nodemailer';
import { ApiError as AppError } from './ApiError.js';

function createTransport() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USERNAME || process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM_EMAIL || process.env.SMTP_FROM || user;
  const fromName = process.env.SMTP_FROM_NAME;
  const missingSettings = [];
  if (!host) missingSettings.push('SMTP_HOST');
  if (!from) missingSettings.push('SMTP_FROM_EMAIL (or SMTP_FROM / SMTP_USERNAME)');
  if (Boolean(user) !== Boolean(pass)) {
    missingSettings.push('SMTP_USERNAME (or SMTP_USER) and SMTP_PASSWORD must be configured together');
  }
  if (missingSettings.length) {
    throw new AppError(503, `Email delivery is not configured: ${missingSettings.join('; ')}`);
  }
  const port = Number(process.env.SMTP_PORT) || 587;
  return {
    from: fromName ? { name: fromName, address: from } : from,
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
