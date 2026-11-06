/**
 * MailFlow Structured Logger & Sensitive Data Sanitizer
 * Redacts secrets, tokens, passwords, and sensitive keys from log output
 */

const SENSITIVE_KEYS = [
  'password',
  'passwordhash',
  'token',
  'accesstoken',
  'refreshtoken',
  'secret',
  'jwt_access_secret',
  'jwt_refresh_secret',
  'encryption_key',
  'authorization',
  'cookie',
  'encryptedaccesstoken',
  'encryptedrefreshtoken',
  'verificationtokenhash',
  'resetpasswordtokenhash',
];

/**
 * Recursively redacts sensitive keys from an object or value
 */
export const sanitizeForLogging = (data, depth = 0) => {
  if (depth > 6) return '[Max Depth Exceeded]';
  if (data === null || data === undefined) return data;

  if (typeof data === 'string') {
    // Redact Bearer tokens in strings
    let sanitized = data.replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]');
    // Redact 64-char hex tokens / encryption keys
    sanitized = sanitized.replace(/([a-f0-9]{32,64})/gi, (match) => {
      // Keep short or common strings, redact long random hashes if in sensitive contexts
      return match.length >= 32 ? match.substring(0, 4) + '...[REDACTED]' : match;
    });
    return sanitized;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForLogging(item, depth + 1));
  }

  if (typeof data === 'object') {
    const clean = {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (SENSITIVE_KEYS.some((sk) => lowerKey.includes(sk))) {
        clean[key] = '[REDACTED]';
      } else {
        clean[key] = sanitizeForLogging(value, depth + 1);
      }
    }
    return clean;
  }

  return data;
};

const formatLog = (level, message, meta = {}) => {
  const timestamp = new Date().toISOString();
  const cleanMeta = Object.keys(meta).length > 0 ? sanitizeForLogging(meta) : undefined;
  
  if (process.env.NODE_ENV === 'production') {
    return JSON.stringify({
      timestamp,
      level,
      message,
      ...(cleanMeta && { meta: cleanMeta }),
    });
  }

  const metaStr = cleanMeta ? ` ${JSON.stringify(cleanMeta)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
};

export const logger = {
  info: (message, meta) => console.log(formatLog('info', message, meta)),
  warn: (message, meta) => console.warn(formatLog('warn', message, meta)),
  error: (message, meta) => console.error(formatLog('error', message, meta)),
  debug: (message, meta) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(formatLog('debug', message, meta));
    }
  },
};
