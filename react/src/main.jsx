import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PostHogProvider } from '@posthog/react'
import './index.css'
import App from './App.jsx'

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

// PostHog (analytics produit). Token "write-only" public via env Vite.
// capture_pageview désactivé : on capture à la main à chaque route (HashRouter).
const posthogOptions = {
  api_host: import.meta.env.VITE_POSTHOG_HOST,
  defaults: '2026-05-30',
  person_profiles: 'identified_only',
  capture_pageview: false,
  capture_pageleave: true,
  mask_all_text: true,
  mask_all_element_attributes: true,
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PostHogProvider apiKey={import.meta.env.VITE_POSTHOG_PROJECT_TOKEN} options={posthogOptions}>
      <App />
    </PostHogProvider>
  </StrictMode>,
)
