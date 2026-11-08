import crypto from 'crypto';
import { env } from '../config/env.js';

// In-memory store for pending Google Auth OAuth states: state -> { codeVerifier, redirectUri, expiresAt }
export const googleAuthStateStore = new Map();

// Generate PKCE code verifier and code challenge (S256)
export const generatePkcePair = () => {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  return { codeVerifier, codeChallenge };
};

/**
 * Service to handle Google OAuth for User Authentication / SSO
 */
export const googleAuthService = {
  isConfigured() {
    return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  },

  /**
   * Generates authorization URL with state and PKCE S256 code challenge
   */
  getAuthorizationUrl({ state, codeChallenge, redirectUri }) {
    if (!this.isConfigured()) {
      throw new Error('Google OAuth credentials are not configured.');
    }

    const callbackUrl = redirectUri || env.GOOGLE_CALLBACK_URL;
    const scopes = [
      'openid',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ];

    const params = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: callbackUrl,
      response_type: 'code',
      scope: scopes.join(' '),
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      access_type: 'offline',
      prompt: 'select_account',
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  },

  /**
   * Initiates Google SSO OAuth flow, saves state + PKCE verifier
   */
  initiateAuth({ redirectUri } = {}) {
    if (!this.isConfigured()) {
      throw new Error('Google OAuth client ID is not configured on the server.');
    }

    const state = crypto.randomBytes(24).toString('hex');
    const { codeVerifier, codeChallenge } = generatePkcePair();

    // 10 minutes expiry for auth state
    googleAuthStateStore.set(state, {
      codeVerifier,
      redirectUri: redirectUri || env.GOOGLE_CALLBACK_URL,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    const url = this.getAuthorizationUrl({ state, codeChallenge, redirectUri });
    return { url, state };
  },

  /**
   * Verifies state and exchanges authorization code using PKCE code_verifier
   */
  async exchangeCodeForUser({ code, state, redirectUri }) {
    if (!state || !googleAuthStateStore.has(state)) {
      throw new Error('Invalid or expired OAuth state. Please try signing in again.');
    }

    const storedState = googleAuthStateStore.get(state);
    googleAuthStateStore.delete(state);

    if (Date.now() > storedState.expiresAt) {
      throw new Error('OAuth authorization session expired. Please try signing in again.');
    }

    const tokenUrl = 'https://oauth2.googleapis.com/token';
    const params = new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri || storedState.redirectUri || env.GOOGLE_CALLBACK_URL,
      grant_type: 'authorization_code',
      code_verifier: storedState.codeVerifier,
    });

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const tokenData = await res.json();
    if (!res.ok) {
      throw new Error(
        tokenData.error_description || tokenData.error || 'Failed to exchange authorization code with Google'
      );
    }

    // Fetch verified profile from userinfo endpoint
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!profileRes.ok) {
      throw new Error('Failed to retrieve user profile from Google');
    }

    const profile = await profileRes.json();

    if (!profile.email) {
      throw new Error('Google account does not provide an email address.');
    }

    if (!profile.verified_email) {
      throw new Error('Google email address is not verified by Google.');
    }

    return {
      googleId: profile.id,
      email: profile.email.toLowerCase().trim(),
      name: profile.name || profile.given_name || profile.email.split('@')[0],
      picture: profile.picture,
    };
  },
};

