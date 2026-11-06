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

class AuthEmailService {
  constructor() {
    this.transporter = null;
    this.initTransporter();
  }

  initTransporter() {
    // Only attempt real SMTP transport if SMTP credentials or host are configured
    if (env.SMTP_USER && env.SMTP_PASS) {
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        },
      });
      console.log(`📧 SMTP Transporter initialized using ${env.SMTP_HOST}:${env.SMTP_PORT}`);
    } else {
      // In development or test without live credentials, fallback to safe console mock
      this.transporter = null;
      console.log('ℹ️ SMTP credentials not provided. Transactional emails will log cleanly to console.');
    }
  }

  async sendMail({ to, subject, html, text }) {
    const from = `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL || env.SMTP_USER || 'noreply@mailflow.io'}>`;
    
    if (this.transporter) {
      try {
        const info = await this.transporter.sendMail({
          from,
          to,
          subject,
          html,
          text: text || html.replace(/<[^>]*>?/gm, ''), // fallback plaintext
        });
        console.log(`✉️ Transactional email sent to ${to}: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
      } catch (error) {
        console.error(`❌ Failed to deliver email to ${to}:`, error.message);
        // Do not throw; return graceful result so auth flow does not completely crash
        return { success: false, error: error.message };
      }
    } else {
      // Safe development/preview log
      console.log('\n================== [TRANSACTIONAL EMAIL DISPATCHED] ==================');
      console.log(`TO:      ${to}`);
      console.log(`FROM:    ${from}`);
      console.log(`SUBJECT: ${subject}`);
      console.log('----------------------------------------------------------------------');
      console.log(text || html.replace(/<[^>]*>?/gm, '').trim());
      console.log('======================================================================\n');
      return { success: true, mode: 'console_dev_preview' };
    }
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

