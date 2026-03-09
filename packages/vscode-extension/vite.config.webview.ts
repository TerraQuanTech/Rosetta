import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [react()],
	build: {
		outDir: resolve(__dirname, "dist", "webview"),
		emptyOutDir: true,
		rollupOptions: {
			input: resolve(__dirname, "webview.html"),
			output: {
				entryFileNames: "webview.js",
				chunkFileNames: "[name].js",
				assetFileNames: "webview.[ext]",
			},
		},
	},
	resolve: {
		alias: {
			"@shared": resolve(__dirname, "../../src/shared"),
			"@": resolve(__dirname, "../../src/ui"),
		},
	},
});
