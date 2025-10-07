import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { viteReactCompiler } from "@ls-stack/vite-plugin-react-compiler";

export default defineConfig({
  base: "/web_file_explorer/",
  plugins: [react(), viteReactCompiler()],
  server: {
    port: 5173,
    open: true
  }
});
