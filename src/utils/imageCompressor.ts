/**
 * Advanced Client-Side Image Compression & Optimization Engine
 * Compresses images instantly in the browser before saving/uploading to prevent
 * Firestore 1MB document quota overflow and optimize offline storage.
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.1 to 1.0
  maxSizeBytes?: number; // Target max size (e.g., 200 * 1024 for 200KB)
  preferredFormat?: 'image/webp' | 'image/jpeg';
}

/**
 * Format bytes to readable Arabic/English string (e.g. 1.2 MB or 85 KB)
 */
export function formatFileSize(bytes: number): string {
  if (bytes <= 0) return '0 بايت';
  const units = ['بايت', 'ك.ب', 'م.ب', 'ج.ب'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i] || 'بايت'}`;
}

/**
 * Calculate approximate byte size of a Data URL (base64) string
 */
export function estimateDataUrlSize(dataUrl: string): number {
  if (!dataUrl || !dataUrl.startsWith('data:')) return 0;
  const base64Str = dataUrl.split(',')[1] || '';
  return Math.round((base64Str.length * 3) / 4);
}

/**
 * Smartly compresses an image file in the browser using HTML5 Canvas.
 * - Scales down mega-pixel camera images to crisp, legible dimensions.
 * - Applies optimal quality compression (WebP / JPEG).
 * - Multi-pass reduction if size exceeds target limit.
 */
export async function compressImageFile(
  file: File,
  maxWidthOrOptions: number | CompressionOptions = 1200,
  maxHeight: number = 1200,
  quality: number = 0.75
): Promise<string> {
  // If not an image (e.g., PDF), return raw base64 or reject
  if (!file.type.startsWith('image/')) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }

  let options: CompressionOptions;
  if (typeof maxWidthOrOptions === 'object') {
    options = {
      maxWidth: 1200,
      maxHeight: 1200,
      quality: 0.75,
      maxSizeBytes: 200 * 1024, // 200KB target
      preferredFormat: 'image/jpeg',
      ...maxWidthOrOptions
    };
  } else {
    options = {
      maxWidth: maxWidthOrOptions,
      maxHeight,
      quality,
      maxSizeBytes: 200 * 1024,
      preferredFormat: 'image/jpeg'
    };
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => {
      // Fallback
      resolve('');
    };

    reader.onload = () => {
      const rawDataUrl = reader.result as string;
      const img = new Image();

      img.onerror = () => {
        // Fallback to original
        resolve(rawDataUrl);
      };

      img.onload = () => {
        try {
          let { width, height } = img;
          const maxW = options.maxWidth || 1200;
          const maxH = options.maxHeight || 1200;

          // Compute aspect-ratio preserved dimensions
          if (width > maxW || height > maxH) {
            const ratio = Math.min(maxW / width, maxH / height);
            width = Math.max(1, Math.round(width * ratio));
            height = Math.max(1, Math.round(height * ratio));
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d', { alpha: false });
          if (!ctx) {
            resolve(rawDataUrl);
            return;
          }

          // Crisp rendering settings for receipts & documents
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // White background for transparent PNGs converted to JPEG
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);

          // Draw the scaled image
          ctx.drawImage(img, 0, 0, width, height);

          // Try format: WebP first for better compression if requested, otherwise JPEG
          let format = options.preferredFormat || 'image/jpeg';
          let currentQuality = options.quality || 0.75;
          let compressedUrl = canvas.toDataURL(format, currentQuality);

          // Multi-pass compression if the resulting dataUrl is still larger than maxSizeBytes
          const targetBytes = options.maxSizeBytes || 250 * 1024;
          let currentBytes = estimateDataUrlSize(compressedUrl);

          if (currentBytes > targetBytes && currentQuality > 0.45) {
            // Second pass with slightly reduced quality
            currentQuality = Math.max(0.45, currentQuality - 0.2);
            compressedUrl = canvas.toDataURL(format, currentQuality);
            currentBytes = estimateDataUrlSize(compressedUrl);
          }

          if (currentBytes > targetBytes && (width > 800 || height > 800)) {
            // Third pass: scale down dimension slightly further
            const scaleDown = 0.75;
            const smallerCanvas = document.createElement('canvas');
            smallerCanvas.width = Math.round(width * scaleDown);
            smallerCanvas.height = Math.round(height * scaleDown);
            const smCtx = smallerCanvas.getContext('2d', { alpha: false });
            if (smCtx) {
              smCtx.imageSmoothingEnabled = true;
              smCtx.imageSmoothingQuality = 'high';
              smCtx.fillStyle = '#FFFFFF';
              smCtx.fillRect(0, 0, smallerCanvas.width, smallerCanvas.height);
              smCtx.drawImage(canvas, 0, 0, smallerCanvas.width, smallerCanvas.height);
              compressedUrl = smallerCanvas.toDataURL(format, 0.65);
            }
          }

          // Return the compressed result
          resolve(compressedUrl);
        } catch (e) {
          console.warn('Canvas compression error, fallback to raw:', e);
          resolve(rawDataUrl);
        }
      };

      img.src = rawDataUrl;
    };

    reader.readAsDataURL(file);
  });
}
