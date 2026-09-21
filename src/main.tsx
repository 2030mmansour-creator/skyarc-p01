import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Intercept and silence benign Vite HMR websocket disconnects in environments with DISABLE_HMR=true
if (typeof window !== 'undefined') {
  const originalError = console.error;
  const originalWarn = console.warn;

  const isBenignDisconnect = (msg: string) => {
    return (
      msg.includes('failed to connect to websocket') ||
      msg.includes('WebSocket closed without opened') ||
      msg.includes('WebSocket') ||
      msg.includes('websocket') ||
      msg.includes('the client is offline')
    );
  };

  console.error = (...args: any[]) => {
    const msg = args.map(a => String(a?.message || a || '')).join(' ');
    if (isBenignDisconnect(msg)) {
      return;
    }
    originalError.apply(console, args);
  };

  console.warn = (...args: any[]) => {
    const msg = args.map(a => String(a?.message || a || '')).join(' ');
    if (isBenignDisconnect(msg)) {
      return;
    }
    originalWarn.apply(console, args);
  };

  window.addEventListener(
    'unhandledrejection',
    (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const errorStr = String(reason?.message || reason?.name || reason || '');
      if (isBenignDisconnect(errorStr)) {
        event.preventDefault();
        event.stopPropagation();
        (event as any).stopImmediatePropagation?.();
      }
    },
    true
  );

  window.addEventListener(
    'error',
    (event: ErrorEvent) => {
      const errorStr = String(event.message || event.error?.message || '');
      if (isBenignDisconnect(errorStr)) {
        event.preventDefault();
        event.stopPropagation();
        (event as any).stopImmediatePropagation?.();
      }
    },
    true
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
