import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { ErrorBoundary } from './components/common/ErrorBoundary.jsx';
import './index.css';

// Global handler for unhandled promise rejections to avoid crashing the view
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    console.warn('[Unhandled Promise Rejection prevented]:', event.reason);
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary level="root">
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
