/**
 * Format numbers with comma separation
 */
export const formatNumber = (val) => {
  if (val === null || val === undefined || isNaN(val)) return '0';
  return Number(val).toLocaleString('en-US');
};

/**
 * Format date nicely (e.g. Sep 04, 2026)
 */
export const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    });
  } catch (e) {
    return dateStr;
  }
};

/**
 * Export array of JSON objects to downloadable CSV
 */
export const exportToCSV = (data, filename = 'edl_export.csv') => {
  if (!data || !data.length) return;

  const headers = Object.keys(data[0]);
  const rows = data.map(item =>
    headers.map(header => {
      let val = item[header];
      if (val === null || val === undefined) val = '';
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
