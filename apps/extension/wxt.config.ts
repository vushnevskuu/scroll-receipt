import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

const srcPath = resolve(import.meta.dirname, 'src');

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
    resolve: {
      alias: [{ find: '@src', replacement: srcPath }],
    },
    envDir: resolve(import.meta.dirname),
  }),
  manifest: {
    name: 'Scroll Receipt',
    description:
      'Tracks short-form video watch time in your browser and sends daily email receipts. Browser activity only — not native mobile apps.',
    version: '2.0.0',
    permissions: ['storage', 'alarms', 'tabs', 'idle'],
    host_permissions: [
      'https://www.youtube.com/*',
      'https://youtube.com/*',
      'https://m.youtube.com/*',
      'https://www.instagram.com/*',
      'https://instagram.com/*',
      'https://www.tiktok.com/*',
      'https://tiktok.com/*',
    ],
    action: { default_title: 'Scroll Receipt' },
    icons: { 16: 'icon/16.png', 48: 'icon/48.png', 128: 'icon/128.png' },
  },
});
