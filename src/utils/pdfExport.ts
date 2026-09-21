import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';

export type PaperSize = 'a4' | 'a3' | 'a5' | 'letter' | 'legal' | 'receipt';
export type PageOrientation = 'portrait' | 'landscape';

export interface PdfExportOptions {
  fileName?: string;
  marginMm?: number;
  scale?: number;
  quality?: number;
  orientation?: PageOrientation;
  paperSize?: PaperSize;
  colorMode?: 'full' | 'grayscale' | 'bw';
}

const PAPER_DIMENSIONS: Record<PaperSize, { width: number; height: number; defaultMargin: number }> = {
  a4: { width: 210, height: 297, defaultMargin: 8 },
  a3: { width: 297, height: 420, defaultMargin: 10 },
  a5: { width: 148, height: 210, defaultMargin: 6 },
  letter: { width: 215.9, height: 279.4, defaultMargin: 8 },
  legal: { width: 215.9, height: 355.6, defaultMargin: 8 },
  receipt: { width: 80, height: 200, defaultMargin: 3 },
};

/**
 * Robust, high-fidelity PDF exporter compatible with Tailwind CSS v4 (oklch colors).
 * Uses html2canvas-pro for modern CSS parsing and jsPDF for reliable document generation.
 */
export async function exportElementToPdf(
  element: HTMLElement,
  options: PdfExportOptions = {}
): Promise<void> {
  const {
    fileName = `document_${new Date().toISOString().slice(0, 10)}.pdf`,
    marginMm,
    scale = 2,
    quality = 0.98,
    orientation = 'portrait',
    paperSize = 'a4',
    colorMode = 'full'
  } = options;

  if (!element) {
    throw new Error('Target element not found for PDF export.');
  }

  const paperConfig = PAPER_DIMENSIONS[paperSize] || PAPER_DIMENSIONS.a4;
  const actualMarginMm = typeof marginMm === 'number' ? marginMm : paperConfig.defaultMargin;

  // Render element to high-res canvas with full support for oklch, lab, color-mix
  const canvas = await html2canvas(element, {
    scale,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    logging: false,
    imageTimeout: 15000,
    windowWidth: element.scrollWidth || 1024,
    onclone: (clonedDoc, clonedElement) => {
      // Ensure clone is visible, expanded, and has exact print colors
      clonedElement.style.maxHeight = 'none';
      clonedElement.style.overflow = 'visible';
      clonedElement.style.backgroundColor = '#ffffff';
      clonedElement.style.color = '#0f172a';
      if (colorMode === 'grayscale') {
        clonedElement.style.filter = 'grayscale(100%)';
      } else if (colorMode === 'bw') {
        clonedElement.style.filter = 'grayscale(100%) contrast(150%)';
      }
    }
  });

  // Calculate paper dimensions based on orientation
  const isLandscape = orientation === 'landscape' && paperSize !== 'receipt';
  const paperWidthMm = isLandscape ? paperConfig.height : paperConfig.width;
  const paperHeightMm = isLandscape ? paperConfig.width : paperConfig.height;

  const printableWidthMm = Math.max(10, paperWidthMm - (actualMarginMm * 2));
  const printableHeightMm = Math.max(10, paperHeightMm - (actualMarginMm * 2));

  // Calculate proportional height of the rendered content in mm
  const contentHeightMm = (canvas.height * printableWidthMm) / canvas.width;

  // For receipt format, allow dynamic height
  const jsPdfFormat = paperSize === 'receipt' 
    ? [80, Math.max(100, contentHeightMm + (actualMarginMm * 2))]
    : paperSize;

  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: jsPdfFormat as any,
    compress: true
  });

  // Single page document
  if (paperSize === 'receipt' || contentHeightMm <= printableHeightMm) {
    const imgData = canvas.toDataURL('image/jpeg', quality);
    pdf.addImage(
      imgData,
      'JPEG',
      actualMarginMm,
      actualMarginMm,
      printableWidthMm,
      contentHeightMm,
      undefined,
      'FAST'
    );
  } else {
    // Multi-page document: slice canvas page by page to guarantee crisp text and exact pagination
    const pageHeightPx = Math.floor((printableHeightMm * canvas.width) / printableWidthMm);
    let renderedHeightPx = 0;
    let pageIndex = 0;

    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = canvas.width;
    const sliceCtx = sliceCanvas.getContext('2d');

    while (renderedHeightPx < canvas.height) {
      if (pageIndex > 0) {
        pdf.addPage(paperSize as any, orientation);
      }

      const currentSliceHeightPx = Math.min(pageHeightPx, canvas.height - renderedHeightPx);
      sliceCanvas.height = currentSliceHeightPx;

      if (sliceCtx) {
        sliceCtx.fillStyle = '#ffffff';
        sliceCtx.fillRect(0, 0, sliceCanvas.width, currentSliceHeightPx);
        sliceCtx.drawImage(
          canvas,
          0,
          renderedHeightPx,
          canvas.width,
          currentSliceHeightPx,
          0,
          0,
          canvas.width,
          currentSliceHeightPx
        );

        const sliceImgData = sliceCanvas.toDataURL('image/jpeg', quality);
        const sliceHeightMm = (currentSliceHeightPx * printableWidthMm) / canvas.width;

        pdf.addImage(
          sliceImgData,
          'JPEG',
          actualMarginMm,
          actualMarginMm,
          printableWidthMm,
          sliceHeightMm,
          undefined,
          'FAST'
        );
      }

      renderedHeightPx += currentSliceHeightPx;
      pageIndex++;
    }
  }

  // Save triggers direct file download to user's disk
  pdf.save(fileName);
}
