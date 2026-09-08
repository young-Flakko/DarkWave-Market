import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        drops: resolve(__dirname, 'drops.html'),
        shop: resolve(__dirname, 'shop.html'),
        login: resolve(__dirname, 'login.html'),
        signup: resolve(__dirname, 'signup.html'),
        account: resolve(__dirname, 'account.html'),
        admin: resolve(__dirname, 'admin.html'),
        store: resolve(__dirname, 'store.html'),
        events: resolve(__dirname, 'events.html'),
        brands: resolve(__dirname, 'brands.html'),
        about: resolve(__dirname, 'about.html'),
        contact: resolve(__dirname, 'contact.html'),
        shipping: resolve(__dirname, 'shipping.html'),
        returns: resolve(__dirname, 'returns.html'),
        faq: resolve(__dirname, 'faq.html'),
        resellerApply: resolve(__dirname, 'reseller-apply.html')
      }
    }
  },
  server: {
    port: 5173,
    open: false
  }
});
