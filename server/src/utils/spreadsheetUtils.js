import * as XLSX from 'xlsx';

/**
 * Safely parse CSV or Excel Buffer into raw rows of key-value objects
 * @param {Buffer} buffer 
 * @param {string} originalName 
 * @returns {Array<Object>}
 */
export const parseUploadedSpreadsheet = (buffer, originalName) => {
  // Safe reading without formula evaluation or macro execution
  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    cellFormula: false,
    cellHTML: false,
    raw: false, // Convert dates/numbers to clean formatted strings
  });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('Spreadsheet does not contain any sheets');
  }

  const sheet = workbook.Sheets[firstSheetName];
  // Parse rows as array of objects keyed by header names
  const rawRows = XLSX.utils.sheet_to_json(sheet, {
    header: 0,
    defval: '',
    blankrows: false,
  });

  return rawRows;
};

/**
 * Normalize and clean string inputs, escaping dangerous formula triggers (=, +, -, @)
 */
export const sanitizeCell = (val) => {
  if (val === null || val === undefined) return '';
  let str = String(val).trim();
  // Prevent CSV Injection / Formula Execution in Excel
  if (/^[=\+\-\@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return str;
};

/**
 * Standard email validator
 */
export const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim().toLowerCase());
};

