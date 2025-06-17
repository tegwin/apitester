const react = require('@vitejs/plugin-react');
const path = require('path');

module.exports = {
  plugins: [react()],
  root: './',
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: './index.html'
    }
  }
};