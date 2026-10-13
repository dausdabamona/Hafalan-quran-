import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/amiri-quran/arabic-400.css';
import './style.css';
import App from './App';
import { mintaPenyimpananTetap } from './db';

mintaPenyimpananTetap();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
