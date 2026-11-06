import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import {
  getVerificationEmailHtml,
  getWelcomeEmailHtml,
  getPasswordResetEmailHtml,
  getPasswordChangedEmailHtml,
  getSecurityLoginAlertHtml,
  getEmailChangeVerificationHtml,
} from './emailTemplateService.js';
import { ApiError } from '../utils/apiResponse.js';
import { sendlibertyProvider } from './email/SendlibertyProvider.js';

class AuthEmailService {
  constructor() {
    this.transporter = null;
    this.initTransporter();
  }

  initTransporter() {
    if (
      env.EMAIL_PROVIDER === 'smtp' &&
      env.SMTP_USER &&
      env.SMTP_PASS
    ) {
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        },
      });
    }
  }

  isConfigured() {
    if (this.transporter) return true;
    if (env.EMAIL_PROVIDER === 'resend') {
      return Boolean(env.RESEND_API_KEY && env.SMTP_FROM_EMAIL);
    }
    if (env.EMAIL_PROVIDER === 'sendliberty') {
      return sendlibertyProvider.isConfigured();
    }
    if (env.EMAIL_PROVIDER === 'smtp') {
      return Boolean(env.SMTP_USER && env.SMTP_PASS);
    }
    return env.EMAIL_PROVIDER === 'console' && env.NODE_ENV !== 'production';
  }

  async sendMail({ to, subject, html, text }) {
    const fromAddress = env.SMTP_FROM_EMAIL || env.SMTP_USER || 'noreply@mailflow.io';
    const from = `"${env.SMTP_FROM_NAME}" <${fromAddress}>`;

    if (!this.isConfigured()) {
      throw new ApiError(503, 'Transactional email is not configured for this service.');
    }

    if (env.EMAIL_PROVIDER === 'resend' && !this.transporter) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
        body: JSON.stringify({
          from,
          to: [to],
          subject,
          html,
          text: text || html.replace(/<[^>]*>?/gm, ''),
        }),
      });

      if (!response.ok) {
        throw new ApiError(502, 'Transactional email provider rejected the message.');
      }

      const result = await response.json();
      return { success: true, messageId: result.id };
    }

    if (env.EMAIL_PROVIDER === 'sendliberty' && !this.transporter) {
      try {
        return await sendlibertyProvider.sendEmail({
          from: env.SENDLIBERTY_FROM_EMAIL,
          to,
          subject,
          html,
          text: text || html.replace(/<[^>]*>?/gm, ''),
        });
      } catch (error) {
        throw new ApiError(502, 'Transactional email delivery failed.');
      }
    }

    if (this.transporter) {
      try {
        const info = await this.transporter.sendMail({
          from,
          to,
          subject,
          html,
          text: text || html.replace(/<[^>]*>?/gm, ''), // fallback plaintext
        });
        return { success: true, messageId: info.messageId };
      } catch (error) {
        throw new ApiError(502, 'Transactional email delivery failed.');
      }
    }

    if (env.EMAIL_PROVIDER === 'console' && env.NODE_ENV !== 'production') {
      console.log('\n================== [TRANSACTIONAL EMAIL LOCAL PREVIEW] ==================');
      console.log(`TO:      ${to}`);
      console.log(`FROM:    ${from}`);
      console.log(`SUBJECT: ${subject}`);
      console.log('----------------------------------------------------------------------');
      console.log(text || html.replace(/<[^>]*>?/gm, '').trim());
      console.log('======================================================================\n');
      return { success: true, mode: 'console_dev_preview' };
    }

    throw new ApiError(503, 'Transactional email is not configured for this service.');
  }

  async sendVerificationEmail(user, rawToken) {
    const verificationUrl = `${env.CLIENT_URL}/verify-email?token=${rawToken}&email=${encodeURIComponent(user.email)}`;
    const html = getVerificationEmailHtml(user.name, verificationUrl);
    return this.sendMail({
      to: user.email,
      subject: 'Verify your MailFlow account',
      html,
    });
  }

  async sendWelcomeEmail(user) {
    const dashboardUrl = `${env.CLIENT_URL}/dashboard`;
    const html = getWelcomeEmailHtml(user.name, dashboardUrl);
    return this.sendMail({
      to: user.email,
      subject: 'Welcome to MailFlow!',
      html,
    });
  }

  async sendPasswordResetEmail(user, rawToken) {
    const resetUrl = `${env.CLIENT_URL}/reset-password?token=${rawToken}&email=${encodeURIComponent(user.email)}`;
    const html = getPasswordResetEmailHtml(user.name, resetUrl);
    return this.sendMail({
      to: user.email,
      subject: 'Reset your MailFlow password',
      html,
    });
  }

  async sendPasswordChangedConfirmation(user, ip) {
    const html = getPasswordChangedEmailHtml(user.name, ip, new Date().toUTCString());
    return this.sendMail({
      to: user.email,
      subject: 'Security Alert: MailFlow password updated',
      html,
    });
  }

  async sendLoginSecurityNotification(user, ip, userAgent) {
    const html = getSecurityLoginAlertHtml(user.name, ip, userAgent, new Date().toUTCString());
    return this.sendMail({
      to: user.email,
      subject: 'Security Alert: New sign-in to MailFlow',
      html,
    });
  }

  async sendEmailChangeVerification(user, rawToken, newEmail) {
    const verifyUrl = `${env.CLIENT_URL}/verify-email-change?token=${rawToken}`;
    const html = getEmailChangeVerificationHtml(user.name, verifyUrl, newEmail);
    return this.sendMail({
      to: newEmail,
      subject: 'Confirm your new MailFlow email address',
      html,
    });
  }
}

export const authEmailService = new AuthEmailService();
export default authEmailService;
