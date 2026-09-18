import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles/variables.css';
import './styles/global.css';
import './styles/components.css';

// Global exception and rejection logging
window.addEventListener('error', (event) => {
  if (window.api && window.api.logger) {
    window.api.logger.error('Uncaught Renderer Error:', event.error?.stack || event.message || event);
  }
});

window.addEventListener('unhandledrejection', (event) => {
  if (window.api && window.api.logger) {
    const reason = event.reason;
    window.api.logger.error('Unhandled Renderer Promise Rejection:', reason?.stack || reason?.message || reason);
  }
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
