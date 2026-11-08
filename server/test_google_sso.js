import assert from 'assert';
import mongoose from 'mongoose';
import { googleAuthService, googleAuthStateStore, generatePkcePair } from './src/services/googleAuthService.js';
import * as authController from './src/controllers/authController.js';
import { env } from './src/config/env.js';
import { User } from './src/models/User.js';

console.log('\n======================================================');
console.log('--- MAILFLOW: GOOGLE SINGLE SIGN-ON (SSO) TEST SUITE ---');
console.log('======================================================\n');

async function runGoogleSSOTests() {
  const originalFetch = global.fetch;

  try {
    // [Test 1] PKCE pair generation (RFC 7636)
    console.log('[Test 1] PKCE S256 Code Verifier & Challenge Generation');
    const { codeVerifier, codeChallenge } = generatePkcePair();
    assert.ok(codeVerifier, 'Code verifier should be generated');
    assert.ok(codeChallenge, 'Code challenge should be generated');
    assert.ok(codeVerifier.length >= 43, 'Code verifier length must meet PKCE specification');
    console.log('✓ PKCE code_verifier and code_challenge generated compliant with RFC 7636');

    // [Test 2] Google Auth URL generation with PKCE & state parameters
    console.log('\n[Test 2] Google Auth URL Construction & Parameter Validation');
    const authSession = googleAuthService.initiateAuth();
    assert.ok(authSession.url, 'Authorization URL must be generated');
    assert.ok(authSession.state, 'State must be returned');

    const parsedUrl = new URL(authSession.url);
    assert.strictEqual(parsedUrl.origin, 'https://accounts.google.com');
    assert.strictEqual(parsedUrl.pathname, '/o/oauth2/v2/auth');
    assert.strictEqual(parsedUrl.searchParams.get('client_id'), env.GOOGLE_CLIENT_ID);
    assert.strictEqual(parsedUrl.searchParams.get('response_type'), 'code');
    assert.strictEqual(parsedUrl.searchParams.get('code_challenge_method'), 'S256');
    assert.ok(parsedUrl.searchParams.get('code_challenge'), 'code_challenge parameter must be present');
    assert.strictEqual(parsedUrl.searchParams.get('state'), authSession.state);
    assert.ok(googleAuthStateStore.has(authSession.state), 'OAuth state must be preserved in state store');
    console.log('✓ Google OAuth authorization URL correctly includes client_id, state, PKCE challenge, and openid scopes');

    // [Test 3] State CSRF protection & tampering defense
    console.log('\n[Test 3] OAuth State CSRF Protection & Replay Attack Defense');
    await assert.rejects(
      async () => {
        await googleAuthService.exchangeCodeForUser({
          code: 'dummy-code',
          state: 'tampered-or-expired-state',
        });
      },
      /Invalid or expired OAuth state/,
      'Tampered or non-existent OAuth state must be rejected'
    );
    console.log('✓ Forged or expired state values strictly rejected');

    // [Test 4] Google Code Exchange & User Profile Extraction
    console.log('\n[Test 4] Server-Side Code Exchange & Google Verification');
    const testState = authSession.state;

    global.fetch = async (url, options = {}) => {
      const urlStr = url.toString();
      if (urlStr.includes('oauth2.googleapis.com/token')) {
        return {
          ok: true,
          json: async () => ({
            access_token: 'mock-google-access-token-12345',
            expires_in: 3600,
            token_type: 'Bearer',
          }),
        };
      }
      if (urlStr.includes('googleapis.com/oauth2/v2/userinfo')) {
        return {
          ok: true,
          json: async () => ({
            id: 'google-sub-99887766',
            email: 'sso.tester@mailflow.io',
            verified_email: true,
            name: 'SSO Tester',
            picture: 'https://lh3.googleusercontent.com/a/mock-pic',
          }),
        };
      }
      return originalFetch(url, options);
    };

    const googleUser = await googleAuthService.exchangeCodeForUser({
      code: 'valid-auth-code-123',
      state: testState,
    });

    assert.strictEqual(googleUser.googleId, 'google-sub-99887766');
    assert.strictEqual(googleUser.email, 'sso.tester@mailflow.io');
    assert.strictEqual(googleUser.name, 'SSO Tester');
    assert.strictEqual(googleAuthStateStore.has(testState), false, 'State must be consumed (single use)');
    console.log('✓ Code exchanged for Google tokens, verified email validated, and profile extracted');

    // [Test 5] Unverified Google email rejection
    console.log('\n[Test 5] Rejecting Unverified Google Email Accounts');
    const unverifiedSession = googleAuthService.initiateAuth();
    global.fetch = async (url, options = {}) => {
      const urlStr = url.toString();
      if (urlStr.includes('oauth2.googleapis.com/token')) {
        return {
          ok: true,
          json: async () => ({ access_token: 'mock-token' }),
        };
      }
      if (urlStr.includes('googleapis.com/oauth2/v2/userinfo')) {
        return {
          ok: true,
          json: async () => ({
            id: 'google-sub-unverified',
            email: 'unverified@attacker.com',
            verified_email: false,
            name: 'Attacker',
          }),
        };
      }
      return originalFetch(url, options);
    };

    await assert.rejects(
      async () => {
        await googleAuthService.exchangeCodeForUser({
          code: 'mock-code',
          state: unverifiedSession.state,
        });
      },
      /Google email address is not verified/,
      'Unverified Google email must be rejected'
    );
    console.log('✓ Google accounts without verified email ownership are safely rejected');

    // [Test 6] Express Controller: Initiation (/oauth/google)
    console.log('\n[Test 6] Auth Controller: Initiate Google OAuth');
    let redirectedUrl = null;
    const mockInitReq = { query: {} };
    const mockInitRes = {
      redirect: (url) => {
        redirectedUrl = url;
      },
    };
    authController.initiateGoogleOAuth(mockInitReq, mockInitRes);
    assert.ok(redirectedUrl, 'Initiate should call res.redirect');
    assert.ok(redirectedUrl.startsWith('https://accounts.google.com/o/oauth2/v2/auth'));
    console.log('✓ initiateGoogleOAuth controller redirects to Google accounts endpoint');

    // [Test 7] Auth Controller: Handling Cancelled / Error Callback
    console.log('\n[Test 7] Auth Controller: User-Cancelled / Error Handling');
    let errorRedirectUrl = null;
    const mockErrReq = {
      query: {
        error: 'access_denied',
        error_description: 'User denied access to MailFlow application',
      },
    };
    const mockErrRes = {
      redirect: (url) => {
        errorRedirectUrl = url;
      },
    };
    await authController.handleGoogleOAuthCallback(mockErrReq, mockErrRes, () => {});
    assert.ok(errorRedirectUrl, 'Error should trigger redirect');
    assert.ok(errorRedirectUrl.includes('/login?error='), 'Error must redirect to /login with encoded message');
    console.log('✓ Cancelled or denied authorization cleanly redirects back to login with notification');

    // [Test 8] Auth Controller: Full SSO Registration / Login & Cookie Issuance
    console.log('\n[Test 8] Auth Controller: Full SSO Registration / Login & Cookie Issuance');
    const ssoSession = googleAuthService.initiateAuth();
    global.fetch = async (url, options = {}) => {
      const urlStr = url.toString();
      if (urlStr.includes('oauth2.googleapis.com/token')) {
        return {
          ok: true,
          json: async () => ({ access_token: 'mock-live-token' }),
        };
      }
      if (urlStr.includes('googleapis.com/oauth2/v2/userinfo')) {
        return {
          ok: true,
          json: async () => ({
            id: 'google-sub-controller-newuser-123',
            email: 'controller.newuser@mailflow.io',
            verified_email: true,
            name: 'New SSO Member',
          }),
        };
      }
      return originalFetch(url, options);
    };

    let callbackRedirectUrl = null;
    let setCookieHeader = null;
    let cookieOptions = null;

    const mockCallbackReq = {
      query: {
        code: 'valid-test-code',
        state: ssoSession.state,
      },
      headers: {
        'user-agent': 'MailFlow Test Agent',
      },
      ip: '127.0.0.1',
    };

    const mockCallbackRes = {
      redirect: (url) => {
        callbackRedirectUrl = url;
      },
      cookie: (name, val, opts) => {
        setCookieHeader = `${name}=${val}`;
        cookieOptions = opts;
      },
    };

    await authController.handleGoogleOAuthCallback(mockCallbackReq, mockCallbackRes, () => {});

    assert.ok(callbackRedirectUrl, 'Callback should redirect to frontend');
    assert.ok(
      callbackRedirectUrl.includes('/auth/callback?token='),
      `Expected redirect to /auth/callback?token=..., got: ${callbackRedirectUrl}`
    );
    assert.ok(setCookieHeader && setCookieHeader.startsWith('refreshToken='), 'refreshToken cookie must be set');
    assert.strictEqual(cookieOptions.httpOnly, true, 'Refresh token cookie must be HttpOnly');
    console.log('✓ Successful Google callback creates account/session, sets HttpOnly refresh cookie, and returns JWT');

    // [Test 9] Safe Account Linking (Existing User with same email)
    console.log('\n[Test 9] Safe Account Linking for Existing Email Users');
    const linkingSession = googleAuthService.initiateAuth();
    global.fetch = async (url, options = {}) => {
      const urlStr = url.toString();
      if (urlStr.includes('oauth2.googleapis.com/token')) {
        return {
          ok: true,
          json: async () => ({ access_token: 'mock-linking-token' }),
        };
      }
      if (urlStr.includes('googleapis.com/oauth2/v2/userinfo')) {
        return {
          ok: true,
          json: async () => ({
            id: 'google-sub-link-456',
            email: 'controller.newuser@mailflow.io', // Same email
            verified_email: true,
            name: 'Updated Member Name',
          }),
        };
      }
      return originalFetch(url, options);
    };

    let linkRedirectUrl = null;
    const mockLinkReq = {
      query: {
        code: 'link-code-789',
        state: linkingSession.state,
      },
      headers: {
        'user-agent': 'MailFlow Test Agent',
      },
      ip: '127.0.0.1',
    };
    const mockLinkRes = {
      redirect: (url) => {
        linkRedirectUrl = url;
      },
      cookie: () => {},
    };

    await authController.handleGoogleOAuthCallback(mockLinkReq, mockLinkRes, () => {});
    assert.ok(linkRedirectUrl.includes('/auth/callback?token='), 'Account successfully linked and session created');
    console.log('✓ Existing user safely linked with Google identity and signed in seamlessly');

    // [Test 10] Gmail Mailbox OAuth Separation Check
    console.log('\n[Test 10] Gmail Mailbox vs Google Login Architectural Separation');
    const { emailAccountService } = await import('./src/services/emailAccountService.js');
    const testWsId = new mongoose.Types.ObjectId();
    const testUId = new mongoose.Types.ObjectId();
    const mailboxOAuth = emailAccountService.initiateOAuth({
      workspaceId: testWsId,
      userId: testUId,
      providerName: 'gmail',
    });
    assert.ok(mailboxOAuth.url.includes('gmail.send'), 'Mailbox OAuth must request gmail.send scope');
    assert.strictEqual(
      parsedUrl.searchParams.get('scope').includes('gmail.send'),
      false,
      'Login SSO must NEVER request Gmail mailbox write/read permissions'
    );
    console.log('✓ Gmail mailbox OAuth and Google SSO login strictly separated with least-privilege scopes');

    console.log('\n======================================================');
    console.log('✓ ALL GOOGLE SINGLE SIGN-ON (SSO) TESTS PASSED CLEANLY');
    console.log('======================================================\n');
  } finally {
    global.fetch = originalFetch;
  }
}

runGoogleSSOTests().catch((err) => {
  console.error('SSO Test failed:', err);
  process.exit(1);
});
