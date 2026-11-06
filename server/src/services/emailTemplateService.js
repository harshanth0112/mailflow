const baseTemplate = (title, content) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #0b0f19;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #f3f4f6;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background-color: #111827;
      border: 1px solid #1f2937;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
    }
    .header {
      padding: 32px 40px;
      background: linear-gradient(135deg, rgba(79, 70, 229, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%);
      border-bottom: 1px solid #1f2937;
      text-align: center;
    }
    .logo {
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #ffffff;
      text-decoration: none;
    }
    .logo span {
      color: #6366f1;
    }
    .content {
      padding: 40px;
      line-height: 1.6;
      color: #d1d5db;
    }
    .h1 {
      font-size: 22px;
      font-weight: 700;
      color: #ffffff;
      margin-top: 0;
      margin-bottom: 16px;
    }
    .button-container {
      margin: 32px 0;
      text-align: center;
    }
    .button {
      display: inline-block;
      padding: 14px 32px;
      background-color: #4f46e5;
      color: #ffffff !important;
      font-weight: 600;
      font-size: 15px;
      text-decoration: none;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(79, 70, 229, 0.35);
    }
    .button:hover {
      background-color: #4338ca;
    }
    .footer {
      padding: 24px 40px;
      background-color: #0d131f;
      border-top: 1px solid #1f2937;
      font-size: 13px;
      color: #6b7280;
      text-align: center;
    }
    .footer a {
      color: #9ca3af;
      text-decoration: underline;
    }
    .code-box {
      background-color: #1f2937;
      border-radius: 6px;
      padding: 12px 16px;
      font-family: monospace;
      font-size: 14px;
      color: #e5e7eb;
      word-break: break-all;
      margin: 16px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <a href="https://mailflow.io" class="logo">Mail<span>Flow</span></a>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} MailFlow Technologies Inc. All rights reserved.</p>
      <p>This is a critical transactional notification related to your MailFlow account security.</p>
    </div>
  </div>
</body>
</html>
`;

export const getVerificationEmailHtml = (name, verificationUrl) => {
  const content = `
    <h1 class="h1">Verify your email address</h1>
    <p>Hi ${name || 'there'},</p>
    <p>Welcome to <strong>MailFlow</strong> — the intelligent email marketing and campaign automation platform. Please confirm your email address to activate your account and access your workspace.</p>
    <div class="button-container">
      <a href="${verificationUrl}" class="button" target="_blank" rel="noopener noreferrer">Verify Email Address</a>
    </div>
    <p>This verification link will expire in 24 hours. If the button above does not work, copy and paste this link into your browser:</p>
    <div class="code-box">${verificationUrl}</div>
    <p>If you did not sign up for a MailFlow account, you can safely ignore this message.</p>
  `;
  return baseTemplate('Verify your email - MailFlow', content);
};

export const getWelcomeEmailHtml = (name, dashboardUrl) => {
  const content = `
    <h1 class="h1">Welcome aboard, ${name}!</h1>
    <p>Your email has been successfully verified, and your primary MailFlow workspace is ready.</p>
    <p>Here is what you can do right away:</p>
    <ul>
      <li>Connect your mailbox or custom SMTP server</li>
      <li>Import and segment your contact lists</li>
      <li>Draft smart campaigns with AI generation and rich templates</li>
      <li>Schedule campaigns with guaranteed queue delivery</li>
    </ul>
    <div class="button-container">
      <a href="${dashboardUrl}" class="button" target="_blank" rel="noopener noreferrer">Open MailFlow Dashboard</a>
    </div>
    <p>If you have any questions, our support team and in-app AI assistant are available 24/7.</p>
  `;
  return baseTemplate('Welcome to MailFlow', content);
};

export const getPasswordResetEmailHtml = (name, resetUrl) => {
  const content = `
    <h1 class="h1">Reset your password</h1>
    <p>Hi ${name || 'there'},</p>
    <p>We received a request to reset the password for your MailFlow account. Click the button below to choose a new password:</p>
    <div class="button-container">
      <a href="${resetUrl}" class="button" target="_blank" rel="noopener noreferrer">Reset Password</a>
    </div>
    <p>This link is valid for 1 hour and can only be used once. If you did not make this request, you can safely ignore this email — your account remains secure.</p>
    <div class="code-box">${resetUrl}</div>
  `;
  return baseTemplate('Reset your password - MailFlow', content);
};

export const getPasswordChangedEmailHtml = (name, ip, time) => {
  const content = `
    <h1 class="h1">Your password has been changed</h1>
    <p>Hi ${name || 'there'},</p>
    <p>This is a security confirmation that your MailFlow account password was recently updated.</p>
    <ul>
      <li><strong>Time:</strong> ${time || new Date().toUTCString()}</li>
      <li><strong>IP Address:</strong> ${ip || 'Unknown'}</li>
    </ul>
    <p>If you made this change, no further action is required.</p>
    <p style="color: #ef4444; font-weight: 600;">If you did not initiate this change, please immediately reset your password or contact MailFlow security support.</p>
  `;
  return baseTemplate('Password changed - MailFlow Security', content);
};

export const getSecurityLoginAlertHtml = (name, ip, userAgent, time) => {
  const content = `
    <h1 class="h1">New sign-in to your account</h1>
    <p>Hi ${name || 'there'},</p>
    <p>A new sign-in was detected for your MailFlow account:</p>
    <ul>
      <li><strong>Time:</strong> ${time || new Date().toUTCString()}</li>
      <li><strong>IP Address:</strong> ${ip || 'Unknown'}</li>
      <li><strong>Device / Client:</strong> ${userAgent || 'Unknown client'}</li>
    </ul>
    <p>If this was you, you can ignore this notice. If you do not recognize this activity, we recommend securing your account immediately.</p>
  `;
  return baseTemplate('Security alert: New login detected - MailFlow', content);
};

export const getEmailChangeVerificationHtml = (name, verifyUrl, newEmail) => {
  const content = `
    <h1 class="h1">Verify your new email address</h1>
    <p>Hi ${name || 'there'},</p>
    <p>You requested to update your MailFlow account email to <strong>${newEmail}</strong>. Please confirm this change:</p>
    <div class="button-container">
      <a href="${verifyUrl}" class="button" target="_blank" rel="noopener noreferrer">Confirm Email Change</a>
    </div>
    <p>This link is valid for 24 hours. If you did not request this change, please contact MailFlow support immediately.</p>
  `;
  return baseTemplate('Confirm email change - MailFlow', content);
};

