import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { IndexedDBVault } from '../../services/indexedDbVault';
import { AttachmentArchiver } from '../../services/attachmentArchiver';
import { FirebaseService } from '../../services/firebase';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  Printer,
  Maximize2,
  Minimize2,
  FileText,
  Image as ImageIcon,
  ExternalLink,
  Receipt,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  RefreshCw,
  Eye,
  Copy,
  Check,
  Link2,
  Share2
} from 'lucide-react';

// @ts-ignore - legacy build avoids modern Promise.try requirement in strict browsers
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

// Setup pdfjs worker with local public file for 100% offline & fast reliability
if (typeof window !== 'undefined' && 'Worker' in window) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  } catch {
    // Falls back to direct in-thread decoding
  }
}

export const AttachmentPreviewModal: React.FC = () => {
  const { previewAttachment, closeAttachmentPreview, setSelectedExpenseForDetail, settings, expenses } = useApp();

  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Image loading / error states
  const [imageLoaded, setImageLoaded] = useState<boolean>(false);
  const [imageError, setImageError] = useState<boolean>(false);

  // Asynchronously resolved URL for cases where base64 data was offloaded to IndexedDB
  const [resolvedUrl, setResolvedUrl] = useState<string>(previewAttachment?.url || '');
  const [isResolvingFromVault, setIsResolvingFromVault] = useState<boolean>(false);

  // PDF rendering states
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pdfNumPages, setPdfNumPages] = useState<number>(0);
  const [pdfCurrentPage, setPdfCurrentPage] = useState<number>(1);
  const [pdfLoading, setPdfLoading] = useState<boolean>(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Pan / drag state for zoomed-in viewing
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const pdfCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<any>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [isAutoRecovering, setIsAutoRecovering] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  const exp = previewAttachment?.expense || (previewAttachment?.expenseId ? expenses.find(e => e.id === previewAttachment.expenseId) : undefined);

  // Build a complete, normalized list of all attachments for this expense
  const allAttachmentsList: { id?: string; url: string; fileName?: string; fileType?: 'pdf' | 'image'; fileSize?: number; pcloudPublicCode?: string; pcloudFileId?: string | number; pcloudWebUrl?: string; pcloudDownloadUrl?: string; pcloudThumbUrl?: string; uploadedAt?: string; source?: string }[] = React.useMemo(() => {
    // 0. From previewAttachment.attachments directly if provided
    if (Array.isArray(previewAttachment?.attachments) && previewAttachment.attachments.length > 0) {
      return previewAttachment.attachments;
    }
    // 1. From expense attachments array
    if (Array.isArray(exp?.attachments) && exp.attachments.length > 0) {
      return exp.attachments;
    }
    // 2. From vault cache if available
    const eid = exp?.id || previewAttachment?.expenseId;
    if (eid) {
      try {
        const vaultRecord = IndexedDBVault.getAttachmentSync(eid);
        if (Array.isArray(vaultRecord?.attachments) && vaultRecord.attachments.length > 0) {
          return vaultRecord.attachments;
        }
      } catch {}
    }
    // 3. From single invoicePhoto
    if (exp?.invoicePhoto && exp.invoicePhoto.trim() !== '') {
      const isOldPdf = Boolean(
        exp.invoicePhoto.startsWith('data:application/pdf') ||
        exp.invoicePhoto.toLowerCase().includes('.pdf') ||
        exp.attachmentFileName?.toLowerCase().endsWith('.pdf')
      );
      return [{
        id: 'legacy-att-0',
        url: exp.invoicePhoto,
        fileName: exp.attachmentFileName || (isOldPdf ? 'مستند_الفاتورة.pdf' : 'صورة_الفاتورة.jpg'),
        fileType: isOldPdf ? ('pdf' as const) : ('image' as const),
        uploadedAt: exp.fingerprintTime
      }];
    }
    // 4. From previewAttachment directly
    if (previewAttachment?.url) {
      const isOldPdf = Boolean(
        previewAttachment.url.startsWith('data:application/pdf') ||
        previewAttachment.url.toLowerCase().includes('.pdf') ||
        previewAttachment?.title?.toLowerCase().endsWith('.pdf')
      );
      return [{
        id: 'single-preview',
        url: previewAttachment.url,
        fileName: previewAttachment?.codedFileName || previewAttachment?.title || (isOldPdf ? 'مستند_الفاتورة.pdf' : 'صورة_الفاتورة.jpg'),
        fileType: isOldPdf ? ('pdf' as const) : ('image' as const)
      }];
    }
    return [];
  }, [exp, previewAttachment]);

  // Explicit current attachment index state for reliable, instant navigation
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  // Initialize or synchronize currentIndex whenever previewAttachment opens or changes
  useEffect(() => {
    if (!previewAttachment) {
      setCurrentIndex(0);
      return;
    }

    if (typeof previewAttachment.initialIndex === 'number' && previewAttachment.initialIndex >= 0 && previewAttachment.initialIndex < allAttachmentsList.length) {
      setCurrentIndex(previewAttachment.initialIndex);
      return;
    }

    if (previewAttachment.url && allAttachmentsList.length > 0) {
      const foundIdx = allAttachmentsList.findIndex(a => 
        (a.url && a.url === previewAttachment.url) ||
        (a.fileName && previewAttachment.codedFileName && a.fileName === previewAttachment.codedFileName)
      );
      if (foundIdx !== -1) {
        setCurrentIndex(foundIdx);
        return;
      }
    }
    setCurrentIndex(0);
  }, [previewAttachment?.url, previewAttachment?.expenseId, previewAttachment?.initialIndex, allAttachmentsList.length]);

  const currentAttachment = allAttachmentsList[currentIndex] || allAttachmentsList[0] || null;
  const rawUrl = resolvedUrl || currentAttachment?.url || previewAttachment?.url || '';

  // Resolve URL on open or when currentIndex changes
  useEffect(() => {
    if (!previewAttachment) {
      setResolvedUrl('');
      return;
    }

    setZoom(1);
    setRotation(0);
    setIsFullscreen(false);
    setImageLoaded(false);
    setImageError(false);
    setPdfDoc(null);
    setPdfNumPages(0);
    setPdfCurrentPage(1);
    setPdfLoading(false);
    setPdfError(null);
    setPanOffset({ x: 0, y: 0 });

    const targetAtt = currentAttachment;
    let initialUrl = targetAtt?.url || (currentIndex === 0 ? previewAttachment.url : '') || '';

    // If initialUrl is a pCloud proxy link, generate direct public link so it works on static deployments
    if (initialUrl && initialUrl.includes('/api/pcloud/')) {
      try {
        const parsed = new URL(initialUrl, window.location.origin);
        const code = parsed.searchParams.get('code') || currentAttachment?.pcloudPublicCode;
        const fileId = parsed.searchParams.get('fileid') || parsed.searchParams.get('fileId') || currentAttachment?.pcloudFileId;
        const region = parsed.searchParams.get('region') || 'us';
        if (code && fileId) {
          const baseApi = region === 'eu' ? 'https://eapi.pcloud.com' : 'https://api.pcloud.com';
          initialUrl = `${baseApi}/getpubthumb?code=${encodeURIComponent(code)}&fileid=${encodeURIComponent(fileId)}&size=2048x2048`;
        }
      } catch {}
    }

    if (initialUrl && initialUrl.trim() !== '') {
      setResolvedUrl(initialUrl);
      setIsResolvingFromVault(false);
      return;
    }

    // Try resolving from Vault synchronously first
    const expenseId = previewAttachment.expenseId || exp?.id;
    const projectId = exp?.projectId || previewAttachment.projectId;

    if (expenseId) {
      const syncRecord = IndexedDBVault.getAttachmentSync(expenseId) ||
        (projectId ? IndexedDBVault.getProjectAttachmentsSync(projectId)[expenseId] : null);

      if (Array.isArray(syncRecord?.attachments) && syncRecord.attachments[currentIndex]?.url) {
        setResolvedUrl(syncRecord.attachments[currentIndex].url);
        setIsResolvingFromVault(false);
        return;
      }
      if (currentIndex === 0 && syncRecord?.dataUrl) {
        setResolvedUrl(syncRecord.dataUrl);
        setIsResolvingFromVault(false);
        return;
      }

      // Asynchronously fetch from IndexedDB, and if missing, fetch from Firestore cloud
      setIsResolvingFromVault(true);

      const resolveFromCloudFallback = async () => {
        try {
          // Tier 1: Check dedicated expense_attachments in Firestore
          const cloudAtt = await FirebaseService.fetchExpenseAttachment(expenseId);
          if (cloudAtt) {
            const chosenUrl = (Array.isArray(cloudAtt.attachments) && cloudAtt.attachments[currentIndex]?.url)
              ? cloudAtt.attachments[currentIndex].url
              : (cloudAtt.dataUrl || '');
            if (chosenUrl) {
              setResolvedUrl(chosenUrl);
              setImageError(false);
              // Cache in local IndexedDB vault for fast subsequent opens
              IndexedDBVault.setAttachment(expenseId, {
                expenseId,
                projectId,
                dataUrl: cloudAtt.dataUrl || chosenUrl,
                attachments: cloudAtt.attachments || [{ url: chosenUrl, fileName: cloudAtt.fileName || 'document.jpg' }]
              }).catch(() => {});
              return true;
            }
          }

          // Tier 2: Check project_bonds_archives in Firestore
          if (projectId) {
            const projectArchives = await FirebaseService.fetchProjectAttachments(projectId);
            const prjItem = projectArchives?.[expenseId];
            const chosenUrl = (Array.isArray(prjItem?.attachments) && prjItem.attachments[currentIndex]?.url)
              ? prjItem.attachments[currentIndex].url
              : (prjItem?.dataUrl || '');
            if (chosenUrl) {
              setResolvedUrl(chosenUrl);
              setImageError(false);
              IndexedDBVault.setAttachment(expenseId, prjItem).catch(() => {});
              return true;
            }
          }

          // Tier 3: Check pCloud direct thumb or proxy if metadata available
          if (currentAttachment?.pcloudPublicCode && currentAttachment?.pcloudFileId) {
            const isCurrentPdf = Boolean(
              currentAttachment.fileType === 'pdf' ||
              currentAttachment.fileName?.toLowerCase().endsWith('.pdf') ||
              currentAttachment.url?.toLowerCase().includes('.pdf') ||
              previewAttachment?.title?.toLowerCase().endsWith('.pdf') ||
              previewAttachment?.subtitle?.toLowerCase().endsWith('.pdf')
            );
            if (isCurrentPdf) {
              // For PDF, use the stream proxy endpoint or current attachment URL, NEVER getpubthumb
              const proxyUrl = currentAttachment.url && !currentAttachment.url.includes('getpubthumb')
                ? currentAttachment.url
                : `/api/pcloud/file-proxy?code=${encodeURIComponent(currentAttachment.pcloudPublicCode)}&fileid=${encodeURIComponent(currentAttachment.pcloudFileId)}&filename=${encodeURIComponent(currentAttachment.fileName || 'document.pdf')}`;
              setResolvedUrl(proxyUrl);
              setImageError(false);
              return true;
            } else {
              const baseApi = 'https://api.pcloud.com';
              const directThumb = `${baseApi}/getpubthumb?code=${encodeURIComponent(currentAttachment.pcloudPublicCode)}&fileid=${encodeURIComponent(currentAttachment.pcloudFileId)}&size=2048x2048`;
              setResolvedUrl(directThumb);
              setImageError(false);
              return true;
            }
          }

          return false;
        } catch (err) {
          console.warn('[AttachmentPreviewModal] Cloud attachment resolution warning:', err);
          return false;
        }
      };

      IndexedDBVault.getAttachment(expenseId).then(async (vaultData) => {
        if (Array.isArray(vaultData?.attachments) && vaultData.attachments[currentIndex]?.url) {
          setResolvedUrl(vaultData.attachments[currentIndex].url);
          setIsResolvingFromVault(false);
          return;
        }
        if (currentIndex === 0 && vaultData?.dataUrl) {
          setResolvedUrl(vaultData.dataUrl);
          setIsResolvingFromVault(false);
          return;
        }

        if (projectId) {
          try {
            const prjMap = await IndexedDBVault.getProjectAttachments(projectId);
            const prjItem = prjMap?.[expenseId];
            if (Array.isArray(prjItem?.attachments) && prjItem.attachments[currentIndex]?.url) {
              setResolvedUrl(prjItem.attachments[currentIndex].url);
              setIsResolvingFromVault(false);
              return;
            }
            if (currentIndex === 0 && prjItem?.dataUrl) {
              setResolvedUrl(prjItem.dataUrl);
              setIsResolvingFromVault(false);
              return;
            }
          } catch {}
        }

        // Not in local IndexedDB (e.g. opened on server/other device), fetch from Firestore cloud!
        const foundInCloud = await resolveFromCloudFallback();
        setIsResolvingFromVault(false);
        if (!foundInCloud) {
          setResolvedUrl('');
          setImageError(true);
        }
      }).catch(async () => {
        const foundInCloud = await resolveFromCloudFallback();
        setIsResolvingFromVault(false);
        if (!foundInCloud) {
          setResolvedUrl('');
          setImageError(true);
        }
      });
    } else {
      setIsResolvingFromVault(false);
      setResolvedUrl('');
      setImageError(true);
    }
  }, [currentIndex, currentAttachment, previewAttachment, exp]);

  // Determine whether this is a PDF
  const isPdf = Boolean(
    rawUrl.startsWith('data:application/pdf') ||
    rawUrl.toLowerCase().includes('.pdf') ||
    rawUrl.includes('application/pdf') ||
    (rawUrl.startsWith('data:') && rawUrl.includes('JVBERi')) ||
    previewAttachment?.title?.toLowerCase().endsWith('.pdf') ||
    previewAttachment?.subtitle?.toLowerCase().endsWith('.pdf') ||
    currentAttachment?.fileType === 'pdf' ||
    currentAttachment?.fileName?.toLowerCase().endsWith('.pdf')
  );

  const handleSelectAttachment = useCallback((index: number) => {
    if (index >= 0 && index < allAttachmentsList.length) {
      setCurrentIndex(index);
    }
  }, [allAttachmentsList.length]);

  const handlePrevAttachment = useCallback(() => {
    setCurrentIndex(prev => Math.max(0, prev - 1));
  }, []);

  const handleNextAttachment = useCallback(() => {
    setCurrentIndex(prev => Math.min(allAttachmentsList.length - 1, prev + 1));
  }, [allAttachmentsList.length]);

  const codedName = previewAttachment?.codedFileName || currentAttachment?.fileName || exp?.attachmentFileName || (isPdf
    ? `سند_${previewAttachment?.expenseId || 'EXP'}.pdf`
    : `سند_${previewAttachment?.expenseId || 'EXP'}.jpg`);
  const fileName = codedName;
  const projectFolder = previewAttachment?.projectFolder || exp?.attachmentProjectFolder;

  // Parse and load PDF via pdfjs
  useEffect(() => {
    if (!previewAttachment || !isPdf || !rawUrl) return;

    let isCancelled = false;
    setPdfLoading(true);
    setPdfError(null);

    const loadPdf = async () => {
      try {
        let pdfData: Uint8Array | string;

        if (rawUrl.startsWith('data:')) {
          const base64Index = rawUrl.indexOf(';base64,');
          if (base64Index !== -1) {
            const base64Str = rawUrl.slice(base64Index + 8);
            const binaryStr = atob(base64Str);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
              bytes[i] = binaryStr.charCodeAt(i);
            }
            pdfData = bytes;
          } else {
            pdfData = rawUrl;
          }
        } else {
          try {
            const res = await fetch(rawUrl);
            const arrayBuffer = await res.arrayBuffer();
            pdfData = new Uint8Array(arrayBuffer);
          } catch {
            // If CORS or local blob, pass URL directly
            pdfData = rawUrl;
          }
        }

        const initParams: any = typeof pdfData === 'string' ? { url: pdfData } : { data: pdfData };
        initParams.disableFontFace = true;
        const loadingTask = pdfjsLib.getDocument(initParams);

        const loadedPdf = await loadingTask.promise;
        if (isCancelled) return;

        setPdfDoc(loadedPdf);
        setPdfNumPages(loadedPdf.numPages);
        setPdfCurrentPage(1);
        setPdfLoading(false);
      } catch (err: any) {
        if (isCancelled) return;
        console.warn('PDF.js loading failed, falling back to native viewer:', err);
        setPdfError(err?.message || 'تعذر فك تشفير مستند الـ PDF عبر عارض الصفحات');
        setPdfLoading(false);
      }
    };

    loadPdf();

    return () => {
      isCancelled = true;
    };
  }, [previewAttachment, isPdf, rawUrl]);

  // Render current PDF page on HTML5 canvas
  const renderPdfPage = useCallback(async () => {
    if (!pdfDoc || !pdfCanvasRef.current) return;

    try {
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore cancel error
        }
      }

      const page = await pdfDoc.getPage(pdfCurrentPage);
      const canvas = pdfCanvasRef.current;
      if (!canvas) return;

      const baseViewport = page.getViewport({ scale: 1, rotation });
      // Scale based on container width or sensible default with zoom
      const containerWidth = canvas.parentElement?.clientWidth || 800;
      const fitScale = Math.min((containerWidth - 32) / baseViewport.width, 1.6);
      const effectiveScale = Math.max(fitScale, 0.7) * zoom;
      const dpr = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale: effectiveScale * dpr, rotation });

      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
      canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const renderContext = {
        canvasContext: ctx,
        viewport
      };

      const renderTask = page.render(renderContext);
      renderTaskRef.current = renderTask;
      await renderTask.promise;
    } catch (err: any) {
      if (err?.name !== 'RenderingCancelledException') {
        console.warn('PDF page rendering warning:', err);
      }
    }
  }, [pdfDoc, pdfCurrentPage, zoom, rotation]);

  useEffect(() => {
    if (pdfDoc && isPdf) {
      renderPdfPage();
    }
  }, [pdfDoc, isPdf, renderPdfPage]);

  // Image load state detector and safety watchdog
  useEffect(() => {
    if (isPdf) return;

    if (!rawUrl || rawUrl.trim() === '') {
      if (!isResolvingFromVault) {
        setImageLoaded(false);
        setImageError(true);
      }
      return;
    }

    setImageLoaded(false);
    setImageError(false);

    // If image is already cached/complete in browser
    if (imgRef.current && imgRef.current.complete) {
      if (imgRef.current.naturalWidth > 0) {
        setImageLoaded(true);
        setImageError(false);
        return;
      }
    }

    // Fast-resolve watchdog: ensure loading spinner never blocks valid images
    const quickTimer = setTimeout(() => {
      if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
        setImageLoaded(true);
        setImageError(false);
      }
    }, 300);

    // Safe ceiling watchdog: if 1.5 seconds elapse, check image status or display image safely
    const safeTimer = setTimeout(() => {
      if (imgRef.current) {
        if (imgRef.current.naturalWidth > 0) {
          setImageLoaded(true);
          setImageError(false);
        } else if (imgRef.current.complete && imgRef.current.naturalWidth === 0) {
          setImageError(true);
          setImageLoaded(false);
        } else {
          // Display whatever is rendered rather than keeping an infinite spinner
          setImageLoaded(true);
        }
      } else if (!rawUrl) {
        setImageError(true);
      }
    }, 1500);

    return () => {
      clearTimeout(quickTimer);
      clearTimeout(safeTimer);
    };
  }, [rawUrl, isPdf, isResolvingFromVault]);

  // Keyboard shortcut listener
  useEffect(() => {
    if (!previewAttachment) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeAttachmentPreview();
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setZoom(z => Math.min(Number((z + 0.25).toFixed(2)), 3.5));
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        setZoom(z => Math.max(Number((z - 0.25).toFixed(2)), 0.5));
      } else if (e.key === '0') {
        e.preventDefault();
        setZoom(1);
        setRotation(0);
        setPanOffset({ x: 0, y: 0 });
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        setRotation(r => (r + 90) % 360);
      } else if (e.key === 'ArrowRight') {
        if (isPdf && pdfNumPages > 1) {
          setPdfCurrentPage(p => Math.min(p + 1, pdfNumPages));
        } else if (allAttachmentsList.length > 1) {
          handlePrevAttachment();
        }
      } else if (e.key === 'ArrowLeft') {
        if (isPdf && pdfNumPages > 1) {
          setPdfCurrentPage(p => Math.max(p - 1, 1));
        } else if (allAttachmentsList.length > 1) {
          handleNextAttachment();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewAttachment, closeAttachmentPreview, isPdf, pdfNumPages, allAttachmentsList.length, handlePrevAttachment, handleNextAttachment]);

  const handleZoomIn = () => setZoom(z => Math.min(Number((z + 0.25).toFixed(2)), 3.5));
  const handleZoomOut = () => setZoom(z => Math.max(Number((z - 0.25).toFixed(2)), 0.5));
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setPanOffset({ x: 0, y: 0 });
  };
  const handleRotate = () => setRotation(r => (r + 90) % 360);

  // Compute the cleanest and most accessible direct URL for copying and external opening
  const directLinkToCopy = React.useMemo(() => {
    if (!rawUrl) return '';
    if (currentAttachment?.pcloudWebUrl) {
      return currentAttachment.pcloudWebUrl;
    }
    if (currentAttachment?.pcloudPublicCode) {
      const code = currentAttachment.pcloudPublicCode;
      const fileId = currentAttachment.pcloudFileId;
      return `https://u.pcloud.link/publink/show?code=${code}${fileId ? `&fileid=${fileId}` : ''}`;
    }
    if (rawUrl.startsWith('/')) {
      return `${window.location.origin}${rawUrl}`;
    }
    return rawUrl;
  }, [rawUrl, currentAttachment]);

  // Handle copying link to clipboard with visual feedback
  const handleCopyLink = async () => {
    if (!directLinkToCopy) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(directLinkToCopy);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = directLinkToCopy;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch (err) {
      console.warn('Copy link error:', err);
    }
  };

  const dataUrlToBlob = (dataUrl: string): Blob | null => {
    try {
      const parts = dataUrl.split(',');
      const mime = parts[0].match(/:(.*?);/)?.[1] || (isPdf ? 'application/pdf' : 'image/jpeg');
      const bstr = atob(parts[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new Blob([u8arr], { type: mime });
    } catch {
      return null;
    }
  };

  // Open in an external browser window/tab
  const handleOpenExternal = () => {
    if (!directLinkToCopy && !rawUrl) return;
    const targetUrl = directLinkToCopy || (rawUrl.startsWith('/') ? `${window.location.origin}${rawUrl}` : rawUrl);
    if (targetUrl.startsWith('data:')) {
      const blob = dataUrlToBlob(targetUrl);
      if (blob) {
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank', 'noopener,noreferrer');
        return;
      }
    }
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  const handleDownload = () => {
    try {
      let downloadHref = rawUrl;
      let needRevoke = false;
      if (rawUrl.startsWith('data:')) {
        const blob = dataUrlToBlob(rawUrl);
        if (blob) {
          downloadHref = URL.createObjectURL(blob);
          needRevoke = true;
        }
      }
      const a = document.createElement('a');
      a.href = downloadHref;
      a.download = fileName;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      if (needRevoke) {
        setTimeout(() => URL.revokeObjectURL(downloadHref), 10000);
      }
    } catch {
      window.open(rawUrl, '_blank');
    }
  };

  const handlePrint = () => {
    if (isPdf) {
      const printWindow = window.open(rawUrl, '_blank');
      if (printWindow) {
        printWindow.focus();
        printWindow.print();
      } else {
        // Fallback: create invisible iframe to print
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '-9999px';
        iframe.style.bottom = '-9999px';
        iframe.style.width = '1000px';
        iframe.style.height = '1000px';
        iframe.style.opacity = '0';
        iframe.src = rawUrl;
        document.body.appendChild(iframe);
        iframe.onload = () => {
          setTimeout(() => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          }, 500);
        };
      }
    } else {
      let printWindow: Window | null = null;
      try {
        printWindow = window.open('', '_blank');
      } catch (e) {
        console.warn('Popup blocked for print window:', e);
      }

      if (printWindow) {
        printWindow.document.write(`
          <html dir="rtl">
            <head>
              <title>${fileName}</title>
              <style>
                body { margin: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; font-family: sans-serif; background: #fff; }
                .header { text-align: center; margin-bottom: 20px; }
                img { max-width: 95%; max-height: 85vh; object-fit: contain; border: 1px solid #ddd; border-radius: 8px; }
                @media print {
                  body { margin: 0; }
                  img { max-width: 100%; max-height: 95vh; }
                }
              </style>
            </head>
            <body>
              <div class="header">
                <h2>معاينة مرفق السند: ${previewAttachment.expenseId || ''}</h2>
                <p>${previewAttachment.subtitle || ''}</p>
              </div>
              <img src="${rawUrl}" onload="window.print();window.close();" />
            </body>
          </html>
        `);
        printWindow.document.close();
      } else {
        // Fallback: iframe print
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '-9999px';
        iframe.style.bottom = '-9999px';
        iframe.style.width = '1000px';
        iframe.style.height = '1000px';
        iframe.style.opacity = '0';
        document.body.appendChild(iframe);
        const doc = iframe.contentWindow?.document;
        if (doc) {
          doc.open();
          doc.write(`
            <html dir="rtl">
              <head>
                <title>${fileName}</title>
                <style>
                  body { margin: 10px; font-family: sans-serif; text-align: center; }
                  img { max-width: 100%; max-height: 90vh; object-fit: contain; }
                </style>
              </head>
              <body>
                <h3>معاينة مرفق السند: ${previewAttachment?.expenseId || ''}</h3>
                <img src="${rawUrl}" />
              </body>
            </html>
          `);
          doc.close();
          setTimeout(() => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          }, 400);
        }
      }
    }
  };

  const handleOpenFullDetail = () => {
    if (exp) {
      closeAttachmentPreview();
      setSelectedExpenseForDetail(exp);
    }
  };

  // Drag to pan for images when zoomed
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      dragStartRef.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      setPanOffset({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  if (!previewAttachment) return null;

  return (
    <div
      id="attachment-preview-modal-backdrop"
      className="fixed inset-0 z-[80] bg-slate-950/90 backdrop-blur-md flex flex-col justify-between items-center p-2 sm:p-4 overflow-hidden animate-in fade-in duration-200"
      onClick={e => {
        if (e.target === e.currentTarget) {
          closeAttachmentPreview();
        }
      }}
    >
      {/* Top Header Bar */}
      <div
        id="attachment-preview-header"
        className="w-full max-w-6xl bg-slate-900/95 text-white rounded-2xl border border-slate-800 p-2 sm:p-3.5 shadow-xl flex items-center justify-between gap-2 sm:gap-3 mb-2 shrink-0 backdrop-blur-md"
      >
        {/* Title & Metadata */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0 shadow-inner">
            {isPdf ? <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-rose-400" /> : <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <h3 className="text-xs sm:text-sm font-bold text-white truncate max-w-[130px] xs:max-w-[190px] sm:max-w-xs md:max-w-md">
                {currentAttachment?.fileName || previewAttachment.title || (previewAttachment.expenseId ? `مرفق سند: ${previewAttachment.expenseId}` : 'معاينة المرفق')}
              </h3>
              <span className={`text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full font-bold shrink-0 ${
                isPdf
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}>
                {isPdf ? 'PDF' : 'صورة'}
              </span>
              {isPdf && pdfNumPages > 1 && (
                <span className="text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono shrink-0">
                  {pdfCurrentPage}/{pdfNumPages}
                </span>
              )}
            </div>
            {allAttachmentsList.length > 1 ? (
              <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 truncate hidden sm:block">
                {exp ? `${exp.projectName} • ${exp.category} • ${exp.amount.toLocaleString()} ${settings.currencySymbol} • مرفق ${currentIndex + 1} من ${allAttachmentsList.length}` : (previewAttachment.subtitle ? `${previewAttachment.subtitle} • مرفق ${currentIndex + 1} من ${allAttachmentsList.length}` : `مرفق ${currentIndex + 1} من ${allAttachmentsList.length}`)}
              </p>
            ) : previewAttachment.subtitle ? (
              <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 truncate hidden sm:block">
                {previewAttachment.subtitle}
              </p>
            ) : null}
            {projectFolder && (
              <div className="hidden md:flex items-center gap-2 mt-1 text-[11px] text-slate-400 flex-wrap">
                <span className="font-mono text-emerald-400 bg-emerald-950/70 px-2 py-0.5 rounded border border-emerald-800/80">
                  📁 {projectFolder}
                </span>
                <span className="font-mono text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700" title={fileName}>
                  📄 {fileName}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Multi-attachment Carousel Switcher */}
        {allAttachmentsList.length > 1 && (
          <div className="flex items-center gap-0.5 sm:gap-1 bg-slate-800/90 rounded-xl p-0.5 sm:p-1 border border-slate-700 shrink-0">
            <button
              type="button"
              onClick={handlePrevAttachment}
              disabled={currentIndex <= 0}
              title="المرفق السابق (سهم يمين)"
              className="p-1 rounded-lg hover:bg-slate-700 disabled:opacity-30 text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            <span className="text-[10px] sm:text-[11px] font-bold text-emerald-400 px-1 whitespace-nowrap font-mono">
              {currentIndex + 1}/{allAttachmentsList.length}
            </span>
            <button
              type="button"
              onClick={handleNextAttachment}
              disabled={currentIndex >= allAttachmentsList.length - 1}
              title="المرفق التالي (سهم يسار)"
              className="p-1 rounded-lg hover:bg-slate-700 disabled:opacity-30 text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
        )}

        {/* Toolbar Controls */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Mobile Quick Actions (External Open & Download) */}
          <div className="flex sm:hidden items-center gap-1">
            <button
              type="button"
              onClick={handleOpenExternal}
              title="فتح في شاشة خارجية"
              className="p-2 rounded-xl bg-slate-800 text-sky-400 hover:bg-slate-700 transition-all cursor-pointer"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleDownload}
              title="تنزيل الملف"
              className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-emerald-400 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>

          {/* Desktop Full Toolbar */}
          <div className="hidden sm:flex items-center gap-1 sm:gap-1.5">
            {/* Zoom Out */}
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoom <= 0.5}
              title="تصغير (-)"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 hover:text-white transition-all cursor-pointer shadow-2xs"
            >
              <ZoomOut className="w-4 h-4" />
            </button>

            {/* Current Zoom Indicator */}
            <button
              type="button"
              onClick={handleReset}
              title="إعادة ضبط المقياس والمركز (0)"
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-bold transition-all cursor-pointer shadow-2xs"
            >
              {Math.round(zoom * 100)}%
            </button>

            {/* Zoom In */}
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoom >= 3.5}
              title="تكبير (+)"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 hover:text-white transition-all cursor-pointer shadow-2xs"
            >
              <ZoomIn className="w-4 h-4" />
            </button>

            {/* Rotate Clockwise */}
            <button
              type="button"
              onClick={handleRotate}
              title="تدوير 90 درجة مع عقارب الساعة (R)"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer shadow-2xs"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            {/* Copy Link to Attachment */}
            <button
              type="button"
              onClick={handleCopyLink}
              title={copiedLink ? 'تم نسخ الرابط إلى الحافظة بنجاح!' : 'نسخ رابط الصورة / المستند (Copy Link)'}
              className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs ${
                copiedLink
                  ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300 ring-2 ring-emerald-500/40'
                  : 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span className="text-xs font-bold hidden md:inline">
                {copiedLink ? 'تم النسخ!' : 'نسخ الرابط'}
              </span>
            </button>

            {/* Open in External Screen / New Tab */}
            <button
              type="button"
              onClick={handleOpenExternal}
              title="فتح المستند في شاشة خارجية / علامة تبويب جديدة مستقلة"
              className="p-2 rounded-xl bg-sky-600/20 border border-sky-500/40 hover:bg-sky-600 hover:text-white text-sky-300 transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="text-xs font-bold hidden md:inline">فتح خارجي</span>
            </button>

            {/* Download */}
            <button
              type="button"
              onClick={handleDownload}
              title="تنزيل المرفق على الجهاز"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
            >
              <Download className="w-4 h-4" />
              <span className="text-xs font-semibold hidden md:inline">تحميل</span>
            </button>

            {/* Print */}
            <button
              type="button"
              onClick={handlePrint}
              title="طباعة الفاتورة"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
            >
              <Printer className="w-4 h-4" />
              <span className="text-xs font-semibold hidden lg:inline">طباعة</span>
            </button>

            {/* Full Screen Toggle */}
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? 'تصغير الشاشة' : 'ملء الشاشة'}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer shadow-2xs"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* View Full Expense Details if applicable */}
            {exp && (
              <button
                type="button"
                onClick={handleOpenFullDetail}
                title="عرض بطاقة تفاصيل السند المالية الكاملة"
                className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-sm"
              >
                <Receipt className="w-4 h-4" />
                <span className="hidden lg:inline">بيانات السند</span>
              </button>
            )}
          </div>

          {/* Close Button: ALWAYS VISIBLE AND PROMINENT ON ALL DEVICES */}
          <button
            type="button"
            onClick={closeAttachmentPreview}
            title="إغلاق المعاينة (Esc)"
            className="p-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold transition-all cursor-pointer shrink-0 ml-0.5 sm:ml-1 shadow-md flex items-center gap-1 z-10"
          >
            <X className="w-4 h-4 sm:w-4 sm:h-4 stroke-[2.5]" />
            <span className="text-xs font-bold sm:hidden">إغلاق</span>
          </button>
        </div>
      </div>

      {/* Main Preview Canvas - Targeted CSS Element */}
      <div
        id="attachment-preview-canvas"
        className={`w-full min-h-0 flex-1 ${
          isFullscreen ? 'max-w-none' : 'max-w-6xl'
        } bg-slate-950/80 border border-slate-800/90 rounded-2xl overflow-hidden flex flex-col items-center justify-center relative p-2 sm:p-4 shadow-2xl backdrop-blur-md select-none transition-all`}
        onDoubleClick={() => {
          if (!isPdf) {
            setZoom(z => (z === 1 ? 1.75 : 1));
            setPanOffset({ x: 0, y: 0 });
          }
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: zoom > 1 && !isPdf ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
      >
        {/* Floating Side Navigators for Multi-attachments */}
        {allAttachmentsList.length > 1 && (
          <>
            {currentIndex > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrevAttachment();
                }}
                title="المرفق السابق (سهم يمين)"
                className="absolute right-3 top-1/2 -translate-y-1/2 z-30 p-2.5 rounded-full bg-slate-900/85 hover:bg-slate-800 text-white border border-slate-700 shadow-xl backdrop-blur-md cursor-pointer transition-all hover:scale-110"
              >
                <ChevronRight className="w-5 h-5 text-emerald-400" />
              </button>
            )}
            {currentIndex < allAttachmentsList.length - 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNextAttachment();
                }}
                title="المرفق التالي (سهم يسار)"
                className="absolute left-3 top-1/2 -translate-y-1/2 z-30 p-2.5 rounded-full bg-slate-900/85 hover:bg-slate-800 text-white border border-slate-700 shadow-xl backdrop-blur-md cursor-pointer transition-all hover:scale-110"
              >
                <ChevronLeft className="w-5 h-5 text-emerald-400" />
              </button>
            )}
          </>
        )}

        {isPdf ? (
          /* PDF Preview Mode */
          <div className="w-full h-full flex flex-col items-center justify-between relative">
            {/* Loading Indicator */}
            {pdfLoading && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/80 text-white gap-3 rounded-xl backdrop-blur-xs">
                <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
                <p className="text-sm font-bold text-slate-200">جارٍ قراءة وفك تشفير صفحات مستند الـ PDF...</p>
                <p className="text-xs text-slate-400">تتم معالجة المستند بأعلى دقة وضوح للطباعة والتدقيق</p>
              </div>
            )}

            {/* Error Fallback with Direct Actions */}
            {pdfError && !pdfDoc && (
              <div className="w-full flex-1 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
                <div className="w-16 h-16 rounded-3xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mb-4 shadow-inner">
                  <FileText className="w-8 h-8" />
                </div>
                <h4 className="text-base font-bold text-white mb-2">{fileName || 'مستند PDF'}</h4>
                <p className="text-xs text-slate-300 max-w-md mb-6 leading-relaxed">
                  يمكنك فتح مستند الـ PDF مباشرة داخل علامة تبويب جديدة أو تنزيله على جهازك لقراءته وطباعته بدقة كاملة:
                </p>

                <div className="flex items-center gap-3 flex-wrap justify-center">
                  <button
                    type="button"
                    onClick={handleOpenExternal}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shadow-md cursor-pointer"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>فتح مستند الـ PDF بالمتصفح</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>تنزيل الملف (PDF)</span>
                  </button>
                </div>
              </div>
            )}

            {/* Rendered PDF Canvas View */}
            {(!pdfError || pdfDoc) && (
              <div className="w-full flex-1 min-h-0 overflow-auto flex items-center justify-center p-2 custom-scrollbar">
                <div
                  style={{
                    transform: `scale(${zoom}) rotate(${rotation}deg)`,
                    transformOrigin: 'center center',
                    transition: isDragging ? 'none' : 'transform 0.15s ease-out'
                  }}
                  className="flex items-center justify-center"
                >
                  <canvas
                    ref={pdfCanvasRef}
                    className="rounded-lg shadow-2xl bg-white max-w-full"
                  />
                </div>
              </div>
            )}

            {/* PDF Multi-page Floating Navigator */}
            {pdfNumPages > 1 && (
              <div className="shrink-0 mt-2 px-4 py-1.5 rounded-full bg-slate-900/90 border border-slate-800 flex items-center gap-3 text-white text-xs shadow-lg backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => setPdfCurrentPage(p => Math.max(p - 1, 1))}
                  disabled={pdfCurrentPage <= 1}
                  className="p-1 rounded-lg hover:bg-slate-800 disabled:opacity-30 transition-colors cursor-pointer"
                  title="الصفحة السابقة"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <span className="font-mono font-bold text-emerald-400">
                  الصفحة {pdfCurrentPage} من {pdfNumPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPdfCurrentPage(p => Math.min(p + 1, pdfNumPages))}
                  disabled={pdfCurrentPage >= pdfNumPages}
                  className="p-1 rounded-lg hover:bg-slate-800 disabled:opacity-30 transition-colors cursor-pointer"
                  title="الصفحة التالية"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Image Preview Mode */
          <div className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden">
            {/* Loading Skeleton */}
            {(!imageLoaded || isResolvingFromVault) && !imageError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/60 text-white gap-3 rounded-xl z-10 backdrop-blur-xs">
                <RefreshCw className="w-7 h-7 text-emerald-400 animate-spin" />
                <p className="text-xs text-slate-300 font-medium">
                  {isResolvingFromVault ? 'جارٍ استرجاع المستند من السحابة والخزنة المشفرة...' : 'جارٍ تحميل صورة الفاتورة والمرفق بدقة كاملة...'}
                </p>
              </div>
            )}

            {/* Error Fallback */}
            {imageError && (
              <div className="flex flex-col items-center justify-center p-6 text-center max-w-md bg-slate-900/80 rounded-2xl border border-slate-800 shadow-2xl backdrop-blur-md">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mb-3 shadow-inner">
                  <AlertCircle className="w-7 h-7" />
                </div>
                <h4 className="text-sm font-bold text-white mb-1.5">تعذر تحميل الصورة داخل المعاينة المباشرة</h4>
                <p className="text-xs text-slate-300 mb-4 leading-relaxed">
                  يمكنك نسخ رابط الصورة المباشر أو فتحه في شاشة خارجية / علامة تبويب مستقلة فوراً:
                </p>
                <div className="flex items-center gap-2 flex-wrap justify-center">
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer ${
                      copiedLink
                        ? 'bg-emerald-600 text-white ring-2 ring-emerald-400'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    }`}
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? 'تم نسخ الرابط!' : 'نسخ رابط الصورة'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenExternal}
                    className="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>فتح في شاشة خارجية</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>تنزيل الملف</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setImageError(false);
                      setImageLoaded(false);
                    }}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>إعادة المحاولة</span>
                  </button>
                </div>
              </div>
            )}

            {/* Image Canvas */}
            <div className="w-full flex-1 min-h-0 overflow-auto flex items-center justify-center p-2 custom-scrollbar">
              <img
                ref={imgRef}
                src={rawUrl}
                alt="معاينة مرفق الفاتورة أو سند الاستلام"
                referrerPolicy="no-referrer"
                onLoad={() => {
                  setImageLoaded(true);
                  setImageError(false);
                  setIsAutoRecovering(false);
                }}
                onError={async () => {
                  if (isAutoRecovering) {
                    setImageError(true);
                    setImageLoaded(false);
                    return;
                  }

                  // If it's a pcloud proxy or remote link, try auto-recovery
                  if (rawUrl && (rawUrl.includes('/api/pcloud/') || rawUrl.startsWith('http'))) {
                    setIsAutoRecovering(true);
                    try {
                      // 1. Try direct fetch as blob
                      const blobRes = await fetch(rawUrl);
                      if (blobRes.ok) {
                        const blob = await blobRes.blob();
                        if (blob.size > 0) {
                          const blobUrl = URL.createObjectURL(blob);
                          setResolvedUrl(blobUrl);
                          setImageError(false);
                          setIsAutoRecovering(false);
                          return;
                        }
                      }
                    } catch (e) {
                      console.warn('[AttachmentPreview] Direct blob conversion failed:', e);
                    }

                    // 2. Try download-base64 endpoint
                    if (rawUrl.includes('/api/pcloud/')) {
                      try {
                        const parsed = new URL(rawUrl, window.location.origin);
                        const code = parsed.searchParams.get('code') || currentAttachment?.pcloudPublicCode;
                        const fileId = parsed.searchParams.get('fileid') || parsed.searchParams.get('fileId') || currentAttachment?.pcloudFileId;
                        const region = parsed.searchParams.get('region') || 'us';
                        if (code && fileId) {
                          // Try direct pCloud thumb first
                          const baseApi = region === 'eu' ? 'https://eapi.pcloud.com' : 'https://api.pcloud.com';
                          const directThumb = `${baseApi}/getpubthumb?code=${encodeURIComponent(code)}&fileid=${encodeURIComponent(fileId)}&size=2048x2048`;
                          setResolvedUrl(directThumb);
                          setImageError(false);
                          setIsAutoRecovering(false);
                          return;
                        }
                      } catch (err) {
                        console.warn('[AttachmentPreview] pCloud recovery error:', err);
                      }
                    }

                    // 3. Try Firestore cloud fetch
                    const expId = previewAttachment?.expenseId || exp?.id;
                    if (expId) {
                      try {
                        const cloudAtt = await FirebaseService.fetchExpenseAttachment(expId);
                        if (cloudAtt) {
                          const chosenUrl = (Array.isArray(cloudAtt.attachments) && cloudAtt.attachments[currentIndex]?.url)
                            ? cloudAtt.attachments[currentIndex].url
                            : (cloudAtt.dataUrl || '');
                          if (chosenUrl && chosenUrl !== rawUrl) {
                            setResolvedUrl(chosenUrl);
                            setImageError(false);
                            setIsAutoRecovering(false);
                            return;
                          }
                        }
                      } catch (err) {
                        console.warn('[AttachmentPreview] Firestore auto-recovery warning:', err);
                      }
                    }

                    setIsAutoRecovering(false);
                  }

                  setImageError(true);
                  setImageLoaded(false);
                }}
                style={{
                  transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                  transformOrigin: 'center center',
                  transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  opacity: imageLoaded ? 1 : 0
                }}
                className="max-h-[76vh] max-w-[92vw] sm:max-w-[80vw] object-contain rounded-xl shadow-2xl select-none"
                draggable={false}
              />
            </div>
          </div>
        )}

        {/* Mobile Floating Bottom Controls Pill */}
        <div className="sm:hidden absolute bottom-3 left-1/2 -translate-x-1/2 z-40 px-3.5 py-1.5 rounded-full bg-slate-900/95 border border-slate-700/90 shadow-2xl flex items-center gap-2 backdrop-blur-md text-white text-xs">
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={zoom <= 0.5}
            className="p-1 rounded-lg hover:bg-slate-800 disabled:opacity-30 text-slate-300"
            title="تصغير"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="px-1.5 py-0.5 rounded font-mono font-bold text-emerald-400 text-[11px]"
            title="إعادة ضبط"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={handleZoomIn}
            disabled={zoom >= 3.5}
            className="p-1 rounded-lg hover:bg-slate-800 disabled:opacity-30 text-slate-300"
            title="تكبير"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <span className="text-slate-700">|</span>
          <button
            type="button"
            onClick={handleRotate}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-300"
            title="تدوير"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleCopyLink}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-300"
            title="نسخ الرابط"
          >
            {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Multi-attachment Gallery Selector Strip */}
      {allAttachmentsList.length > 1 && (
        <div
          id="attachment-preview-gallery-strip"
          className="w-full max-w-6xl mt-2 p-2 rounded-2xl bg-slate-900/95 border border-slate-800 flex items-center gap-2 overflow-x-auto custom-scrollbar shrink-0 shadow-lg backdrop-blur-md"
        >
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-bold px-2 shrink-0 border-l border-slate-800 pl-3">
            <span>جميع مستندات السند ({allAttachmentsList.length}):</span>
          </div>
          <div className="flex items-center gap-2 min-w-0">
            {allAttachmentsList.map((att, idx) => {
              const isSelected = idx === currentIndex;
              const isAttPdf = Boolean(
                att.fileType === 'pdf' ||
                att.url?.startsWith('data:application/pdf') ||
                att.url?.toLowerCase().includes('.pdf') ||
                att.fileName?.toLowerCase().endsWith('.pdf')
              );
              return (
                <button
                  key={att.id || `att-strip-${idx}`}
                  type="button"
                  onClick={() => handleSelectAttachment(idx)}
                  className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-600/30 border-emerald-500 text-white shadow-sm ring-2 ring-emerald-500/40'
                      : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold ${
                    isSelected ? 'bg-emerald-500 text-slate-950' : 'bg-slate-700 text-slate-300'
                  }`}>
                    {idx + 1}
                  </span>
                  {isAttPdf ? (
                    <FileText className={`w-3.5 h-3.5 ${isSelected ? 'text-rose-300' : 'text-rose-400'}`} />
                  ) : (
                    <ImageIcon className={`w-3.5 h-3.5 ${isSelected ? 'text-emerald-300' : 'text-emerald-400'}`} />
                  )}
                  <span className="max-w-[130px] truncate text-[11px]">
                    {att.fileName || `مستند #${idx + 1}`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer Info Bar */}
      <div
        id="attachment-preview-footer"
        className="hidden sm:flex w-full max-w-6xl mt-2 py-2 px-4 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-400 text-[11px] items-center justify-between gap-2 shrink-0 backdrop-blur-md"
      >
        <div className="flex items-center gap-2 truncate">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <span className="truncate">
            💡 {isPdf
              ? 'معاينة المستند: يمكنك التنقل بين الصفحات والتحكم بالتكبير والتدوير والطباعة.'
              : 'نصيحة: انقر نقراً مزدوجاً للتكبير، أو اسحب بالفأرة للتنقل داخل الفاتورة عند التكبير.'}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0 text-slate-300 font-mono">
          <span>المقياس: {Math.round(zoom * 100)}%</span>
          {rotation !== 0 && <span>التدوير: {rotation}°</span>}
          <span className="text-slate-500 hidden sm:inline">Esc للإغلاق</span>
        </div>
      </div>
    </div>
  );
};
