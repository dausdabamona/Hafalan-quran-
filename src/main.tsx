import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/amiri-quran/arabic-400.css';
import '@fontsource/plus-jakarta-sans/latin-400.css';
import '@fontsource/plus-jakarta-sans/latin-600.css';
import '@fontsource/plus-jakarta-sans/latin-700.css';
import '@fontsource/plus-jakarta-sans/latin-400-italic.css';
import './style.css';
import App from './App';
import { mintaPenyimpananTetap } from './db';
import { pasangSatuSuara } from './pemutar';
import { pasangPintasan } from './pintasan';
import { pasangPapanKetik } from './papanKetik';
import { pasangTema } from './tema';

pasangTema();
mintaPenyimpananTetap();
pasangSatuSuara();
pasangPintasan();
pasangPapanKetik();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
