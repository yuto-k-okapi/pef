import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { installConsoleCapture } from './lib/diagnostics';

// Capture PDF.js / runtime warnings so they're visible in the in-app log panel
// without needing DevTools.
installConsoleCapture();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
