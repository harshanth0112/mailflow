import multer from 'multer';

// Use memory storage for fast, safe parsing without leaving unencrypted temporary files on disk
const storage = multer.memoryStorage();

// Supported MIME types and extensions for CSV & Excel
const allowedMimes = [
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', // Some OS/browsers send CSV as text/plain
  'application/csv',
];

const fileFilter = (req, file, cb) => {
  const ext = file.originalname.toLowerCase().split('.').pop();
  if (['csv', 'xlsx', 'xls'].includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only CSV and Excel (.xlsx, .xls) files are supported.'), false);
  }
};

export const uploadContactFile = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1,
  },
  fileFilter,
});

