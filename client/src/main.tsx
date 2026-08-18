import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Register service worker for PWA updates
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      // Check for updates every 30 seconds
      setInterval(() => {
        registration.update();
      }, 30000);

      // Listen for new service worker activation
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'activated') {
              // Show update notification
              if (Notification.permission === 'granted') {
                new Notification('Lion Heart POS Updated', {
                  body: 'The app has been updated. Refresh to see changes.',
                  icon: '/icon.svg',
                });
              }
            }
          });
        }
      });
    }).catch((err) => {
      console.log('SW registration failed:', err);
    });
  });
}
