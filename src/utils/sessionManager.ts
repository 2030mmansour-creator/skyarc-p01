/**
 * Session and Device Detection Utilities for Single-Device Enforcement
 */

export function getClientDeviceSummary(): string {
  if (typeof window === 'undefined' || !navigator) return 'متصفح غير معروف';

  const userAgent = navigator.userAgent || '';
  let os = 'جهاز غير معروف';
  if (/windows/i.test(userAgent)) {
    os = 'Windows';
  } else if (/macintosh|mac os x/i.test(userAgent)) {
    os = 'macOS';
  } else if (/iphone/i.test(userAgent)) {
    os = 'iPhone (iOS)';
  } else if (/ipad/i.test(userAgent)) {
    os = 'iPad (iPadOS)';
  } else if (/android/i.test(userAgent)) {
    os = 'Android';
  } else if (/linux/i.test(userAgent)) {
    os = 'Linux';
  }

  let browser = 'متصفح الويب';
  if (/edg/i.test(userAgent)) {
    browser = 'Microsoft Edge';
  } else if (/chrome|crios/i.test(userAgent) && !/opr|opera/i.test(userAgent)) {
    browser = 'Google Chrome';
  } else if (/firefox|fxios/i.test(userAgent)) {
    browser = 'Mozilla Firefox';
  } else if (/safari/i.test(userAgent) && !/chrome|crios/i.test(userAgent)) {
    browser = 'Apple Safari';
  } else if (/opr|opera/i.test(userAgent)) {
    browser = 'Opera';
  }

  const screenDim = typeof window !== 'undefined' && window.screen ? `${window.screen.width}×${window.screen.height}` : '';
  return `${browser} على ${os}${screenDim ? ` (${screenDim})` : ''}`;
}

export function generateSessionId(): string {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 11);
  const cryptoRandom = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().substring(0, 8) : randomStr;
  return `sess_${timestamp}_${cryptoRandom}`;
}
