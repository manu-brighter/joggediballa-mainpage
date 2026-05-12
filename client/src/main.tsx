import { trpc } from '@/lib/trpc';
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchStreamLink, TRPCClientError } from '@trpc/client';
import { createRoot } from 'react-dom/client';
import superjson from 'superjson';
import App from './App';
// Self-hosted Inter variable font (no Google Fonts CDN → no third-party
// data transfer, simpler revDSG/GDPR posture).
import '@fontsource-variable/inter';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

// Log errors but don't auto-redirect to login
// Users should be able to browse the public website without authentication
queryClient.getQueryCache().subscribe(event => {
  if (event.type === 'updated' && event.action.type === 'error') {
    const error = event.query.state.error;
    // Only log errors, don't redirect
    if (
      error instanceof TRPCClientError &&
      error.message !== UNAUTHED_ERR_MSG
    ) {
      console.error('[API Query Error]', error);
    }
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === 'updated' && event.action.type === 'error') {
    const error = event.mutation.state.error;
    // Only log errors, don't redirect
    if (
      error instanceof TRPCClientError &&
      error.message !== UNAUTHED_ERR_MSG
    ) {
      console.error('[API Mutation Error]', error);
    }
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchStreamLink({
      url: '/api/trpc',
      transformer: superjson,
      // Phase 3b CSRF guard: the server accepts /api/* non-GET requests when
      // either the Origin matches APP_ORIGIN OR this header is present.
      headers: () => ({ 'x-trpc-source': 'web' }),
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: 'include',
        });
      },
    }),
  ],
});

createRoot(document.getElementById('root')!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>,
);
