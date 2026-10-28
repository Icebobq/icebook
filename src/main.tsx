import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import '@fontsource/libre-caslon-text/400.css'
import '@fontsource/libre-caslon-text/700.css'
import '@fontsource/libre-caslon-text/400-italic.css'
import '@fontsource/montserrat/400.css'
import '@fontsource/montserrat/500.css'
import '@fontsource/montserrat/600.css'
import './index.css'
import { I18nProvider } from './i18n/index.tsx'
import { LibraryProvider } from './store/library.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <LibraryProvider>
        <App />
      </LibraryProvider>
    </I18nProvider>
  </StrictMode>,
)
