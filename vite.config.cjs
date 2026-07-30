const { defineConfig } = require("vite");
const react = require("@vitejs/plugin-react");

module.exports = defineConfig({
  plugins: [react()],
  optimizeDeps: {
    noDiscovery: true,
    include: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
});
