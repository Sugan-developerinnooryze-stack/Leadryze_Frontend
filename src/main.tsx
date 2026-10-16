import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';
import { applyTheme, getInitialTheme } from './utils/theme';
// Created in its own module (not inline here) so auth.store.ts can import
// the SAME instance and clear it on login/logout — see queryClient.ts's own
// comment for why that clear is load-bearing, not just hygiene.
import { queryClient } from './services/queryClient';

// As early as possible, before the first paint of app content — see
// utils/theme.ts for why this can't be an inline <script> in index.html
// (the CSP has no 'unsafe-inline' for script-src).
applyTheme(getInitialTheme());

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: { fontFamily: 'Inter, sans-serif', fontSize: '14px' },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
