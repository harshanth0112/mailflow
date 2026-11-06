/**
 * Utility to safely escape untrusted string input for HTML rendering
 * Prevents XSS attacks in email clients
 */
export const escapeHtml = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

/**
 * Replace placeholders like {{firstName}}, {{lastName}}, {{email}}, {{company}}
 * Escaping untrusted values for HTML and keeping plaintext clean
 */
export const personalizeContent = ({ content, contact, isHtml = false }) => {
  if (!content) return '';

  const values = {
    firstName: contact.firstName || '',
    lastName: contact.lastName || '',
    email: contact.email || '',
    company: contact.company || '',
    jobTitle: contact.jobTitle || '',
  };

  return content.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
    const rawVal = values[key] !== undefined ? values[key] : '';
    return isHtml ? escapeHtml(rawVal) : rawVal;
  });
};

