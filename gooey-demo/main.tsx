import { createRoot } from 'react-dom/client';
import GooeyInputDemo from '../components/gooey-input-demo';
import './style.css';
const darkMode = matchMedia('(prefers-color-scheme: dark)');
function applyTheme() { document.documentElement.classList.toggle('dark', darkMode.matches); }
darkMode.addEventListener('change', applyTheme);
applyTheme();
createRoot(document.getElementById('root')!).render(<GooeyInputDemo />);
