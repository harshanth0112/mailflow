import ExcelJS from 'exceljs';
import { Readable } from 'stream';

/**
 * Safely parse CSV or Excel buffer into raw rows of key-value objects.
 * Uses ExcelJS instead of SheetJS to avoid GHSA-4r6h-8v6p-xvw6 (Prototype Pollution)
 * and GHSA-5pgg-2g8v-p4x9 (ReDoS). ExcelJS never evaluates formulas or executes macros.
 *
 * @param {Buffer} buffer
 * @param {string} originalName
 * @returns {Promise<Array<Object>>}
 */
export const parseUploadedSpreadsheet = async (buffer, originalName) => {
  const lowerName = (originalName || '').toLowerCase();
  const isCsv = lowerName.endsWith('.csv');

  const workbook = new ExcelJS.Workbook();

  if (isCsv) {
    // Parse CSV via ExcelJS streaming CSV reader
    const stream = Readable.from(buffer);
    await workbook.csv.read(stream, {
      parserOptions: { skipEmptyLines: true },
    });
  } else {
    // Parse xlsx/xls — ExcelJS never evaluates cell formulas or macros
    await workbook.xlsx.load(buffer);
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('Spreadsheet does not contain any sheets');
  }

  // Extract header row
  const headerRow = worksheet.getRow(1);
  const headers = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber - 1] = sanitizeCell(cell.text || cell.value?.toString() || '');
  });

  if (headers.length === 0 || headers.every((h) => !h)) {
    throw new Error('Spreadsheet header row is empty or unreadable');
  }

  const rawRows = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header

    const obj = {};
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const header = headers[colNumber - 1];
      if (!header) return;
      // Always read as plain text — never as formula result or computed value
      const val = cell.text || (cell.value !== null && cell.value !== undefined ? String(cell.value) : '');
      obj[header] = sanitizeCell(val);
    });

    // Skip completely empty rows
    if (Object.values(obj).some((v) => v !== '')) {
      rawRows.push(obj);
    }
  });

  return rawRows;
};

/**
 * Normalize and clean string inputs, escaping dangerous formula triggers (=, +, -, @)
 * Prevents CSV injection / formula execution when re-exported to spreadsheet clients.
 */
export const sanitizeCell = (val) => {
  if (val === null || val === undefined) return '';
  const raw = String(val);
  let str = raw.trim();
  // Prevent CSV Injection / Formula Execution in Excel
  if (/^[=+\-@\t\r]/.test(raw) || /^[=+\-@\t\r]/.test(str)) {
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
