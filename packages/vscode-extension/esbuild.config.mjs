import * as esbuild from "esbuild";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

await esbuild.build({
	entryPoints: [resolve(__dirname, "src/extension.ts")],
	bundle: true,
	outfile: resolve(__dirname, "dist/extension.js"),
	external: ["vscode"],
	format: "cjs",
	platform: "node",
	target: "node18",
	sourcemap: true,
	minify: false,
	mainFields: ["module", "main"],
});
