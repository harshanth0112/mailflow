import assert from 'assert';
import nodemailer from 'nodemailer';

process.env.NODE_ENV = 'development';
process.env.MONGODB_URI = '';
process.env.REDIS_URL = '';
process.env.QUEUE_FEATURES_ENABLED = 'false';
process.env.EMAIL_PROVIDER = 'console';
process.env.SMTP_USER = '';
process.env.SMTP_PASS = '';

const { authEmailService } = await import('./src/services/authEmailService.js');
const {
  register,
  verifyEmail,
  login,
  refreshToken,
  logout,
} = await import('./src/controllers/authController.js');

const invokeController = async (handler, req) => {
  const response = {
    statusCode: 200,
    cookies: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
    cookie(name, value, options) {
      this.cookies[name] = { value, options };
      return this;
    },
    clearCookie(name, options) {
      this.clearedCookie = { name, options };
      return this;
    },
  };
  let controllerError;
  await handler(req, response, (error) => {
    controllerError = error;
  });
  if (controllerError) throw controllerError;
  return response;
};

const request = (body = {}, cookies = {}) => ({
  body,
  cookies,
  headers: { 'user-agent': 'deployment-readiness-test' },
  ip: '127.0.0.1',
  connection: { remoteAddress: '127.0.0.1' },
});

const run = async () => {
  authEmailService.transporter = nodemailer.createTransport({
    streamTransport: true,
    newline: 'windows',
    buffer: true,
  });

  const user = {
    name: 'Deployment Test',
    email: `deployment-${Date.now()}@example.test`,
    password: 'StageOne!Test123',
  };
  const registration = await invokeController(register, request(user));
  const verificationToken = registration.payload.data._devVerificationToken;
  assert.ok(verificationToken, 'Development verification token missing');

  await invokeController(verifyEmail, request({ email: user.email, token: verificationToken }));
  const loginResponse = await invokeController(
    login,
    request({ email: user.email, password: user.password })
  );
  const loginCookie = loginResponse.cookies.refreshToken;
  assert.ok(loginCookie, 'Login did not set refresh cookie');
  assert.strictEqual(loginCookie.options.httpOnly, true);
  assert.strictEqual(loginCookie.options.path, '/api/v1/auth');
  assert.ok(!('refreshToken' in loginResponse.payload.data), 'Login exposed refresh token in JSON');

  const refreshed = await invokeController(
    refreshToken,
    request({}, { refreshToken: loginCookie.value })
  );
  const rotatedCookie = refreshed.cookies.refreshToken;
  assert.ok(rotatedCookie, 'Refresh did not rotate the cookie');
  assert.notStrictEqual(rotatedCookie.value, loginCookie.value);
  assert.ok(!('refreshToken' in refreshed.payload.data), 'Refresh exposed token in JSON');

  const bodyOnlyRefresh = await invokeController(
    refreshToken,
    request({ refreshToken: rotatedCookie.value })
  );
  assert.strictEqual(bodyOnlyRefresh.statusCode, 401, 'Refresh accepted a JavaScript-visible body token');

  const logoutResponse = await invokeController(
    logout,
    request({}, { refreshToken: rotatedCookie.value })
  );
  assert.strictEqual(logoutResponse.clearedCookie.name, 'refreshToken');
  assert.strictEqual(logoutResponse.clearedCookie.options.path, '/api/v1/auth');
  console.log('Cookie-only registration, login, refresh rotation, and logout checks passed.');
};

run().catch((error) => {
  console.error('Deployment readiness test failed:', error);
  process.exitCode = 1;
});
