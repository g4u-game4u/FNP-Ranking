import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './style.css';

// Performance monitoring
const startTime = performance.now();

// Hide initial loading screen when app is ready
const hideInitialLoading = () => {
  const loadingElement = document.querySelector('.initial-loading');
  if (loadingElement) {
    loadingElement.remove();
  }
  document.body.classList.add('app-ready');
  
  // Log performance metrics
  const loadTime = performance.now() - startTime;
  // console.log(`App loaded in ${loadTime.toFixed(2)}ms`);
};

// Create root and render app
const root = ReactDOM.createRoot(document.getElementById('app')!);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Hide loading screen after React has rendered
setTimeout(hideInitialLoading, 100);

// Performance observer for monitoring
if ('PerformanceObserver' in window) {
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.entryType === 'largest-contentful-paint') {
        // console.log('LCP:', entry.startTime);
      }
      if (entry.entryType === 'first-input') {
        const fidEntry = entry as PerformanceEventTiming;
        // console.log('FID:', fidEntry.processingStart - fidEntry.startTime);
      }
      if (entry.entryType === 'layout-shift') {
        const clsEntry = entry as any; // Layout shift entries have different typing
        // console.log('CLS:', clsEntry.value);
      }
    }
  });
  
  observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'] });
}

// Register service worker for PWA capabilities
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('SW registered: ', registration);
      
      // Listen for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New content is available, reload immediately for kiosk mode
              console.log('New content available, reloading...');
              window.location.reload();
            }
          });
        }
      });
      
      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'CACHE_UPDATED') {
          console.log('Cache updated, reloading...');
          window.location.reload();
        }
      });
      
      // Check for updates every 5 minutes in kiosk mode
      setInterval(() => {
        registration.update();
      }, 5 * 60 * 1000);
    } catch (error) {
      console.log('SW registration failed: ', error);
    }
  });
}
