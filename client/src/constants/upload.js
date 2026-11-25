/**
 * Shared Attachment & File Upload Constants for EDL IMS Client
 */

export const MAX_ATTACHMENT_KB = 800;
export const MAX_ATTACHMENT_BYTES = MAX_ATTACHMENT_KB * 1024; // 819,200 bytes

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

/**
 * Format bytes into human readable KB or MB with 1 decimal place.
 * e.g. 819200 -> "800.0 KB", 1258291 -> "1.2 MB"
 */
export function formatFileSize(bytes) {
  if (typeof bytes !== 'number' || isNaN(bytes)) return '0 KB';
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / 1024).toFixed(1)} KB`;
}

/**
 * Validates a file's size and type.
 * @param {File} file
 * @returns {{ valid: boolean, error?: string, code?: 'LIMIT_FILE_SIZE' | 'INVALID_TYPE' }}
 */
export function validateAttachmentFile(file) {
  if (!file) return { valid: true };

  const ext = file.name ? file.name.slice(file.name.lastIndexOf('.')).toLowerCase() : '';
  const isTypeAllowed =
    (file.type && ALLOWED_IMAGE_TYPES.includes(file.type.toLowerCase())) ||
    ALLOWED_IMAGE_EXTENSIONS.includes(ext);

  if (!isTypeAllowed) {
    return {
      valid: false,
      code: 'INVALID_TYPE',
      error: 'Invalid file type. Only JPG, PNG, and WebP images are allowed.'
    };
  }

  if (file.size > MAX_ATTACHMENT_BYTES) {
    return {
      valid: false,
      code: 'LIMIT_FILE_SIZE',
      error: `File is too large (${formatFileSize(file.size)}). Maximum allowed size is ${MAX_ATTACHMENT_KB} KB.`
    };
  }

  return { valid: true };
}

