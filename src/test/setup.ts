import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Garantir variáveis públicas dummy em ambiente de teste unitário se não definidas
if (!import.meta.env.VITE_SUPABASE_URL) {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://test-project.supabase.co');
}
if (!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY && !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test_key');
}
if (!import.meta.env.VITE_PUBLIC_APP_URL) {
  vi.stubEnv('VITE_PUBLIC_APP_URL', 'https://cardapio.exemplo.com.br');
}

