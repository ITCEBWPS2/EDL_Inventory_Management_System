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
 * Format date and time as DD/MM/YYYY HH:mm
 */
export const formatDateTime = (val) => {
  if (!val || !String(val).trim()) return '—';

  const datePart = formatDate(val);
  if (datePart === '—') return '—';

  const str = String(val).trim();
  const timeMatch = str.match(/(?:T|\s)(\d{1,2}:\d{2})(?::\d{2})?/);
  if (timeMatch) {
    return `${datePart} ${timeMatch[1]}`;
  }

  if (val instanceof Date && !isNaN(val.getTime())) {
    const hh = String(val.getHours()).padStart(2, '0');
    const mm = String(val.getMinutes()).padStart(2, '0');
    return `${datePart} ${hh}:${mm}`;
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
 * Export array of JSON objects to downloadable CSV
 * Automatically formats any ISO date strings to DD/MM/YYYY
 */
export const exportToCSV = (data, filename = 'edl_export.csv') => {
  if (!data || !data.length) return;

  const headers = Object.keys(data[0]);
  const rows = data.map(item =>
    headers.map(header => {
      let val = item[header];
      if (val === null || val === undefined) val = '';

      // If value is a raw ISO date string YYYY-MM-DD, format to DD/MM/YYYY
      if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val.trim())) {
        val = formatDate(val.trim());
      }

      val = String(val).replace(/"/g, '""');
      return `"${val}"`;
    }).join(',')
  );

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
