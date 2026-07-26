import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

import { AuthProvider } from '@/features/auth';
import { CommandPaletteProvider } from '@/features/command';
import { ToastProvider } from '@/components/ui';
import { queryClient } from '@/lib/queryClient';
import { AppRouter } from '@/routes/AppRouter';

import './styles/main.scss';

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <CommandPaletteProvider>
              <AppRouter />
            </CommandPaletteProvider>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
