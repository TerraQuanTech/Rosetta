import { resolve } from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [react()],
	root: "src/ui",
	build: {
		outDir: "../../dist",
		emptyOutDir: true,
	},
	resolve: {
		alias: {
			"@": resolve(__dirname, "src/ui"),
		},
	},
	server: {
		port: 5173,
		strictPort: true,
	},
});
