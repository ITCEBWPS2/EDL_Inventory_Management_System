import { MAX_ATTACHMENT_BYTES } from '../constants/upload';

/**
 * Compresses an image file (JPEG, PNG, WebP) using HTML5 Canvas to fit under maxBytes (default 800 KB).
 * Progressively reduces quality and dimensions (never upscaling) until the file size is under the threshold.
 *
 * @param {File} file
 * @param {number} maxBytes
 * @returns {Promise<File>}
 */
export async function compressImageToLimit(file, maxBytes = MAX_ATTACHMENT_BYTES) {
  if (!file) {
    throw new Error('No file provided for compression');
  }

  // If already under the limit, return original file
  if (file.size <= maxBytes) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error('Failed to read image file.'));

    reader.onload = () => {
      const img = new Image();

      img.onerror = () => reject(new Error('Failed to load image into memory for compression.'));

      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (!width || !height) {
          return reject(new Error('Invalid image dimensions.'));
        }

        // Cap initial dimensions to 1920px max to avoid massive canvas memory usage
        const MAX_INIT_DIM = 1920;
        if (width > MAX_INIT_DIM || height > MAX_INIT_DIM) {
          const ratio = Math.min(MAX_INIT_DIM / width, MAX_INIT_DIM / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Could not initialize canvas 2D context.'));
        }

        // Target MIME: WebP if original is WebP, otherwise JPEG (PNG doesn't support quality lossy compression)
        const targetMime = file.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
        const targetExt = targetMime === 'image/webp' ? '.webp' : '.jpg';
        const originalBase = file.name.replace(/\.[^/.]+$/, '');
        const newFileName = `${originalBase}_compressed${targetExt}`;

        let currentW = width;
        let currentH = height;
        let currentQuality = 0.85;

        const attemptCompression = async () => {
          for (let step = 0; step < 10; step++) {
            canvas.width = currentW;
            canvas.height = currentH;
            ctx.clearRect(0, 0, currentW, currentH);

            // Fill white background for potential transparent PNGs converted to JPEG
            if (targetMime === 'image/jpeg') {
              ctx.fillStyle = '#FFFFFF';
              ctx.fillRect(0, 0, currentW, currentH);
            }

            ctx.drawImage(img, 0, 0, currentW, currentH);

            const blob = await new Promise((resBlob) => {
              canvas.toBlob((b) => resBlob(b), targetMime, currentQuality);
            });

            if (blob && blob.size <= maxBytes) {
              const compressedFile = new File([blob], newFileName, {
                type: targetMime,
                lastModified: Date.now()
              });
              return resolve(compressedFile);
            }

            // Step down quality first, then dimensions
            if (currentQuality > 0.45) {
              currentQuality -= 0.15;
            } else {
              currentW = Math.round(currentW * 0.8);
              currentH = Math.round(currentH * 0.8);
              currentQuality = 0.75;
            }

            if (currentW < 240 || currentH < 240) {
              break;
            }
          }

          reject(new Error(`Unable to compress image below ${Math.round(maxBytes / 1024)} KB without excessive quality loss.`));
        };

        attemptCompression().catch(reject);
      };

      img.src = reader.result;
    };

    reader.readAsDataURL(file);
  });
}

