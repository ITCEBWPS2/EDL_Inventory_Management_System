/**
 * Format numbers with comma separation
 */
export const formatNumber = (val) => {
  if (val === null || val === undefined || isNaN(val)) return '0';
  return Number(val).toLocaleString('en-US');
};

/**
 * Check if day, month, year form a valid calendar date
 */
export const isValidDateParts = (day, month, year) => {
  const d = parseInt(day, 10);
  const m = parseInt(month, 10);
  const y = parseInt(year, 10);
  if (isNaN(d) || isNaN(m) || isNaN(y)) return false;
  if (y < 1900 || y > 2100) return false;
  if (m < 1 || m > 12) return false;
  const daysInMonth = [
    31,
    (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 29 : 28,
    31, 30, 31, 30, 31, 31, 30, 31, 30, 31
  ];
  if (d < 1 || d > daysInMonth[m - 1]) return false;
  return true;
};

/**
 * Check if a DD/MM/YYYY date string is valid
 */
export const isValidDateString = (ddMMyyyy) => {
  if (!ddMMyyyy || typeof ddMMyyyy !== 'string') return false;
  const match = ddMMyyyy.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return false;
  return isValidDateParts(match[1], match[2], match[3]);
};

/**
 * Format date consistently as DD/MM/YYYY (e.g. 13/10/2026, 27/04/2008)
 * Does NOT shift the day due to time zones.
 * Returns '—' for empty or invalid dates.
 */
export const formatDate = (val) => {
  if (!val || !String(val).trim()) return '—';

  // Handle Date instance
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '—';
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${d}/${m}/${y}`;
  }

  const str = String(val).trim();

  // Handle ISO format YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    if (isValidDateParts(d, m, y)) {
      return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
    }
    return '—';
  }

  // Handle DD/MM/YYYY or D/M/YYYY
  const dmyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    if (isValidDateParts(d, m, y)) {
      return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
    }
    return '—';
  }

  return '—';
};

/**
 * Format date & time consistently as DD/MM/YYYY HH:mm (e.g. 05/11/2026 09:35)
 * 24-hour format, no seconds, no US format.
 * Returns '—' for empty or invalid dates.
 */
export const formatDateTime = (val = new Date()) => {
  if (!val) return '—';

  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '—';
    const day = String(val.getDate()).padStart(2, '0');
    const month = String(val.getMonth() + 1).padStart(2, '0');
    const year = val.getFullYear();
    const hours = String(val.getHours()).padStart(2, '0');
    const minutes = String(val.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }

  const str = String(val).trim();
  if (!str) return '—';

  // If it's a string, try parsing as Date or regex
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }

  // Fallback for custom formatted strings
  const datePart = formatDate(str);
  if (datePart === '—') return '—';
  const timeMatch = str.match(/(?:T|\s)(\d{1,2}:\d{2})(?::\d{2})?/);
  if (timeMatch) {
    const [hh, mm] = timeMatch[1].split(':');
    return `${datePart} ${hh.padStart(2, '0')}:${mm.padStart(2, '0')}`;
  }

  return datePart;
};

/**
 * Convert DD/MM/YYYY (or already ISO) string to ISO YYYY-MM-DD string
 * Returns '' for empty or invalid values.
 */
export const toISODate = (val) => {
  if (!val || !String(val).trim()) return '';
  const str = String(val).trim();

  // Already ISO
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    if (isValidDateParts(d, m, y)) {
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return '';
  }

  // DD/MM/YYYY
  const dmyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    if (isValidDateParts(d, m, y)) {
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return '';
  }

  return '';
};

/**
 * Convert ISO YYYY-MM-DD (or Date) to display DD/MM/YYYY string
 * Returns '' for empty or invalid values.
 */
export const fromISODate = (val) => {
  if (!val || !String(val).trim()) return '';
  const formatted = formatDate(val);
  return formatted === '—' ? '' : formatted;
};

/**
 * Parse a DD/MM/YYYY string into a Date object (local timezone)
 * Returns null for invalid dates.
 */
export const parseDate = (ddMMyyyy) => {
  if (!ddMMyyyy || typeof ddMMyyyy !== 'string') return null;
  const match = ddMMyyyy.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, dStr, mStr, yStr] = match;
  if (!isValidDateParts(dStr, mStr, yStr)) return null;
  return new Date(parseInt(yStr, 10), parseInt(mStr, 10) - 1, parseInt(dStr, 10));
};

/**
 * Formats a single CSV field value according to RFC 4180 and Excel security standards:
 * - Null / undefined converted to empty string
 * - ISO dates (YYYY-MM-DD) converted to DD/MM/YYYY
 * - CSV / formula injection protection: prefixes a single quote (') to text cells starting with =, +, -, @, tab (\t), or CR (\r)
 *   (Numeric values such as positive/negative integers and decimals are preserved unaltered)
 * - Escapes internal quotes by doubling them ("")
 * - Encloses fields in double quotes if they contain commas, quotes, or line breaks (CRLF / LF)
 */
export const formatCSVField = (rawValue) => {
  if (rawValue === null || rawValue === undefined) return '';

  let val = rawValue;
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val.trim())) {
    val = formatDate(val.trim());
  }

  const str = String(val);

  // Check if value is a plain number (including positive/negative numbers like -10, +5, 3.14)
  const isPlainNumber = typeof val === 'number' || (typeof val === 'string' && /^[+\-]?\d+(\.\d+)?$/.test(val.trim()));

  let formatted = str;
  // Formula injection protection for text cells
  if (!isPlainNumber && /^[=+\-@\t\r]/.test(str)) {
    formatted = `'${str}`;
  }

  // Escape double quotes
  formatted = formatted.replace(/"/g, '""');

  // Wrap in double quotes if field contains comma, quote, line break or carriage return
  if (/[",\n\r]/.test(formatted)) {
    return `"${formatted}"`;
  }
  return formatted;
};

/**
 * Builds UTF-8 CSV text with prepended Byte Order Mark (\uFEFF / EF BB BF)
 * Ensures Excel recognizes UTF-8 encoding so non-ASCII characters (en dash, Sinhala, symbols) render cleanly.
 */
export const buildCSVWithBOM = (data) => {
  const BOM = '\uFEFF';
  let csvText = '';

  if (typeof data === 'string') {
    csvText = data;
  } else if (Array.isArray(data) && data.length > 0) {
    const headers = Object.keys(data[0]);
    const headerLine = headers.map(h => formatCSVField(h)).join(',');
    const rowLines = data.map(item =>
      headers.map(header => formatCSVField(item[header])).join(',')
    );
    csvText = [headerLine, ...rowLines].join('\r\n');
  } else {
    csvText = '';
  }

  return csvText.startsWith(BOM) ? csvText : BOM + csvText;
};

/**
 * Export array of JSON objects or raw CSV text to downloadable CSV file.
 * Automatically prepends UTF-8 BOM so Microsoft Excel opens it without garbling characters.
 * Safe for all non-ASCII characters (en-dashes, Sinhala, Tamil, accented letters, symbols like ², °, µ, ×).
 */
export const exportToCSV = (data, filename = 'edl_export.csv') => {
  if (!data) return;
  if (Array.isArray(data) && data.length === 0) return;

  const contentWithBom = buildCSVWithBOM(data);

  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return contentWithBom;
  }

  const blob = new Blob([contentWithBom], { type: 'text/csv;charset=utf-8;' });
  const url = (window.URL || URL).createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  (window.URL || URL).revokeObjectURL(url);
  return contentWithBom;
};

/**
 * Verification Yearly Cycle Thresholds
 * - DUE_SOON_START_MONTH: Month (1-indexed, 11 = November). If current year has no completed verification
 *   and current month is November or December, status is "Due soon".
 * - GRACE_PERIOD_END_MONTH: Month (1-indexed, 1 = January). If current year has no verification yet,
 *   previous year's verification is granted grace through January, after which it becomes "Overdue" (Feb 1).
 */
export const VERIFICATION_CYCLE_CONFIG = {
  DUE_SOON_START_MONTH: 11, // November
  GRACE_PERIOD_END_MONTH: 1 // January
};

/**
 * Calculates verification cycle status chip details.
 * Rule:
 * 1. Green "Up to date": Last confirmed verification completed within the current calendar year.
 * 2. Amber "Due soon": Current year has no verification yet, and we are in November or December (within 60 days of year end).
 * 3. Red "Overdue": Last verification was in a previous year and current year has none after January (Feb 1 onwards).
 * 4. Amber "Due soon" (Grace): In January of the new year, if previous year was completed.
 * 5. Grey "Not started": No confirmed verification exists at all.
 */
export const getVerificationCycleStatus = (lastDateStr) => {
  if (!lastDateStr || typeof lastDateStr !== 'string' || !lastDateStr.trim()) {
    return {
      status: 'not_started',
      label: 'Not started',
      colorClass: 'bg-surface border border-line text-slate'
    };
  }

  const trimmed = lastDateStr.trim();
  let vYear = null;
  if (trimmed.includes('-')) {
    vYear = parseInt(trimmed.split('-')[0], 10);
  } else if (trimmed.includes('/')) {
    vYear = parseInt(trimmed.split('/')[2], 10);
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12

  if (!vYear || isNaN(vYear)) {
    return {
      status: 'not_started',
      label: 'Not started',
      colorClass: 'bg-surface border border-line text-slate'
    };
  }

  // 1. Within current calendar year (or future cycle) -> Up to date
  if (vYear >= currentYear) {
    return {
      status: 'up_to_date',
      label: 'Up to date',
      colorClass: 'bg-[#40916C]/10 text-[#40916C] border border-[#40916C]/30'
    };
  }

  // 2. In November or December with no current year verification -> Due soon
  if (currentMonth >= VERIFICATION_CYCLE_CONFIG.DUE_SOON_START_MONTH) {
    return {
      status: 'due_soon',
      label: 'Due soon',
      colorClass: 'bg-[#D97706]/10 text-[#D97706] border border-[#D97706]/30'
    };
  }

  // 3. Past January grace period without current year verification -> Overdue
  if (currentMonth > VERIFICATION_CYCLE_CONFIG.GRACE_PERIOD_END_MONTH) {
    return {
      status: 'overdue',
      label: 'Overdue',
      colorClass: 'bg-[#B4483A]/10 text-[#B4483A] border border-[#B4483A]/30'
    };
  }

  // 4. In January grace period -> Due soon
  return {
    status: 'due_soon',
    label: 'Due soon',
    colorClass: 'bg-[#D97706]/10 text-[#D97706] border border-[#D97706]/30'
  };
};

/**
 * Format relative calendar-day difference from date string (YYYY-MM-DD or DD/MM/YYYY).
 * Calendar-day based, zero time zone shifts.
 * Returns 'Today', 'Yesterday', 'N days ago', 'N months ago', 'N years ago'.
 */
export const formatRelativeDays = (val) => {
  if (!val || typeof val !== 'string' || !val.trim()) return '';
  const trimmed = val.trim();
  let y, m, d;

  if (trimmed.includes('-')) {
    const parts = trimmed.split('T')[0].split('-').map(Number);
    y = parts[0];
    m = parts[1];
    d = parts[2];
  } else if (trimmed.includes('/')) {
    const parts = trimmed.split('/').map(Number);
    d = parts[0];
    m = parts[1];
    y = parts[2];
  } else {
    return '';
  }

  if (!y || !m || !d || isNaN(y) || isNaN(m) || isNaN(d)) return '';

  const target = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const diffMs = today.getTime() - target.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays === -1) return 'Tomorrow';
  if (diffDays < 0) return `${Math.abs(diffDays)} days in future`;
  if (diffDays < 30) return `${diffDays} days ago`;

  if (diffDays < 365) {
    const months = Math.max(1, Math.round(diffDays / 30.4375));
    return months === 1 ? '1 month ago' : `${months} months ago`;
  }

  const years = Math.max(1, Math.round(diffDays / 365.25));
  return years === 1 ? '1 year ago' : `${years} years ago`;
};

