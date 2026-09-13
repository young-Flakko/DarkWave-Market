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
      adminOrders: resolve(__dirname, 'admin-orders.html'),
      adminUsers: resolve(__dirname, 'admin-users.html'),
      adminDrops: resolve(__dirname, 'admin-drops.html'),
      adminAnalytics: resolve(__dirname, 'admin-analytics.html'),
      adminEvents: resolve(__dirname, 'admin-events.html'),
      adminHome: resolve(__dirname, 'admin-home.html'),
        adminBrands: resolve(__dirname, 'admin-brands.html'),
        store: resolve(__dirname, 'store.html'),
        events: resolve(__dirname, 'events.html'),
        brands: resolve(__dirname, 'brands.html'),
        about: resolve(__dirname, 'about.html'),
        contact: resolve(__dirname, 'contact.html'),
        shipping: resolve(__dirname, 'shipping.html'),
        returns: resolve(__dirname, 'returns.html'),
        faq: resolve(__dirname, 'faq.html'),
        resellerApply: resolve(__dirname, 'reseller-apply.html'),
        cart: resolve(__dirname, 'cart.html'),
        favorites: resolve(__dirname, 'favorites.html'),
        notifications: resolve(__dirname, 'notifications.html'),
        wallet: resolve(__dirname, 'wallet.html'),
        messages: resolve(__dirname, 'messages.html'),
        checkout: resolve(__dirname, 'checkout.html'),
        product: resolve(__dirname, 'product.html'),
        orderSuccess: resolve(__dirname, 'order-success.html'),
        myOrders: resolve(__dirname, 'my-orders.html'),
        seller: resolve(__dirname, 'seller.html'),
        sellerOrders: resolve(__dirname, 'seller-orders.html')
      }
    }
  },
  server: {
    port: 5173,
    open: false
  }
});
