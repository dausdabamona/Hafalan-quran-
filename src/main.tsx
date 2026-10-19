import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/amiri-quran/arabic-400.css';
import '@fontsource/source-serif-4/latin-400.css';
import '@fontsource/source-serif-4/latin-600.css';
import '@fontsource/source-serif-4/latin-400-italic.css';
import './style.css';
import App from './App';
import { mintaPenyimpananTetap } from './db';
import { pasangSatuSuara } from './pemutar';

mintaPenyimpananTetap();
pasangSatuSuara();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
