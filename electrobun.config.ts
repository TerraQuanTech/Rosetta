import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { ElectrobunConfig } from "electrobun";

const tsconfigPaths: Record<string, string> = {
	"@shared": resolve("src/shared"),
	"@bun": resolve("src/bun"),
	"@": resolve("src/ui"),
};

const packageAliases: Record<string, string> = {
	"@terraquantech/rosetta-core": resolve("packages/core/src/index.ts"),
};

const extensions = [".ts", ".tsx", ".js", ".jsx", ""];

const tsconfigPathsPlugin: import("bun").BunPlugin = {
	name: "tsconfig-paths",
	setup(build) {
		// Resolve exact package aliases
		for (const [pkg, target] of Object.entries(packageAliases)) {
			const filter = new RegExp(`^${pkg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);
			build.onResolve({ filter }, () => ({ path: target }));
		}

		// Resolve prefix path aliases (@shared/*, @bun/*, @/*)
		for (const [alias, target] of Object.entries(tsconfigPaths)) {
			const filter = new RegExp(`^${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/`);
			build.onResolve({ filter }, (args) => {
				const rel = args.path.slice(alias.length + 1);
				const base = resolve(target, rel);
				for (const ext of extensions) {
					const full = base + ext;
					if (existsSync(full)) return { path: full };
				}
				return { path: base };
			});
		}
	},
};

export default {
	app: {
		name: "Rosetta",
		identifier: "dev.rosetta.i18n",
		version: "0.3.2",
	},
	release: {
		baseUrl: "https://github.com/TerraQuanTech/rosetta/releases",
	},
	build: {
		bun: {
			entrypoint: "src/bun/index.ts",
			plugins: [tsconfigPathsPlugin],
		},
		copy: {
			"dist/index.html": "views/mainview/index.html",
			"dist/assets": "views/mainview/assets",
			scripts: "scripts",
		},
		mac: {
			bundleCEF: false,
			icons: "assets/icon.iconset",
		},
		linux: {
			bundleCEF: false,
			icon: "assets/icon.png",
		},
		win: {
			bundleCEF: false,
			icon: "assets/icon.ico",
		},
	},
	runtime: {
		exitOnLastWindowClosed: true,
	},
} satisfies ElectrobunConfig;
