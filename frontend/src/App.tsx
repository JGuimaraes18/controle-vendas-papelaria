import './App.css'
import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './app/routes';
import { ToastProvider } from './components/ui/Toast';

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AppRoutes />
      </ToastProvider>
    </BrowserRouter>
  );
}