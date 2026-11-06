/**
 * MongoDB Sanitize Middleware
 * Recursively strips keys starting with '$' or containing '.' from req.body, req.query, and req.params
 * to prevent NoSQL injection attacks.
 */

const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item));
  }

  for (const key of Object.keys(obj)) {
    // Prohibit keys starting with $ or containing a period in object keys
    if (key.startsWith('$') || key.includes('.')) {
      delete obj[key];
    } else if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
      // If a property is an object whose keys are all mongo operators, clean it up
      sanitizeObject(obj[key]);
      if (Object.keys(obj[key]).length === 0) {
        delete obj[key];
      }
    } else {
      sanitizeObject(obj[key]);
    }
  }

  return obj;
};

export const mongoSanitize = (req, res, next) => {
  if (req.body) req.body = sanitizeObject(req.body);
  if (req.query) req.query = sanitizeObject(req.query);
  if (req.params) req.params = sanitizeObject(req.params);
  next();
};
