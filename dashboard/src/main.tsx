import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { applyTheme, cachedTheme } from './theme';
import './tailwind.css';
import './styles.css';

// Start in the member's last colours so nothing flashes before the account theme loads.
applyTheme(cachedTheme());

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
