import { Command } from "commander";
import { TranslationFileStore } from "./store";

type MissingReport = {
	namespace: string;
	locale: string;
	missingKeys: string[];
};

export async function handleCliMode() {
	const program = new Command()
		.name("rosetta")
		.description("Translation editor and CLI tool for JSON locale files")
		.version("0.1.1")
		.argument("<dir>", "Path to the locales directory");

	program
		.command("stats")
		.description("Show translation coverage statistics")
		.action(async () => {
			const store = await loadStore(program);
			await showStats(store);
		});

	program
		.command("missing")
		.description("Show missing keys by locale and namespace")
		.action(async () => {
			const store = await loadStore(program);
			await showMissing(store);
		});

	program
		.command("complete")
		.description("List locales with 100% coverage")
		.action(async () => {
			const store = await loadStore(program);
			await showComplete(store);
		});

	program
		.command("list-locales")
		.description("List all available locales")
		.action(async () => {
			const store = await loadStore(program);
			await listLocales(store);
		});

	program
		.command("list-keys")
		.description("List all keys in namespaces and locales")
		.argument("[namespace]", "Filter by specific namespace")
		.option("--locale <code>", "Filter by specific locale")
		.action(async (namespace: string | undefined, options: { locale?: string }) => {
			const store = await loadStore(program);
			await listKeys(store, namespace, options.locale);
		});

	program
		.command("add-locale")
		.description("Create a new locale")
		.argument("<code>", "Locale code to create")
		.option("--copy-from <source>", "Copy content from existing locale")
		.action(async (code: string, options: { copyFrom?: string }) => {
			const store = await loadStore(program);
			await addLocaleCommand(store, code, options.copyFrom);
		});

	try {
		await program.parseAsync(process.argv);
		if (!process.argv.slice(2).length) {
			program.outputHelp();
		}
	} catch (err) {
		console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
		process.exit(1);
	}
}

async function loadStore(program: Command): Promise<TranslationFileStore> {
	const dir = program.args[0];
	const store = new TranslationFileStore(dir);
	await store.load();
	return store;
}

async function showMissing(store: TranslationFileStore) {
	const storeData = store.getStore();
	const missing: MissingReport[] = [];

	for (const nsNode of storeData.namespaces) {
		const ns = typeof nsNode === "string" ? nsNode : nsNode.path;
		const nsData = storeData.translations[ns] || {};

		for (const locale of storeData.locales) {
			const localeKeys = new Set<string>();
			for (const key in nsData) {
				if (nsData[key]?.[locale]) {
					localeKeys.add(key);
				}
			}

			const missingKeys = Object.keys(nsData).filter((key) => !localeKeys.has(key));
			if (missingKeys.length > 0) {
				missing.push({ namespace: ns, locale, missingKeys });
			}
		}
	}

	if (missing.length === 0) {
		console.log("✓ All keys are present in all locales");
		return;
	}

	console.log(`\nMissing keys (${missing.length} total):\n`);

	const byNamespace = new Map<string, { locale: string; keys: string[] }[]>();
	for (const report of missing) {
		if (!byNamespace.has(report.namespace)) {
			byNamespace.set(report.namespace, []);
		}
		byNamespace.get(report.namespace)!.push({ locale: report.locale, keys: report.missingKeys });
	}

	for (const [ns, localeReports] of byNamespace.entries()) {
		console.log(`  Namespace: ${ns}`);
		for (const { locale, keys } of localeReports) {
			console.log(`    ${locale.toUpperCase()}: ${keys.length} missing`);
			for (const key of keys.slice(0, 3)) {
				console.log(`      • ${key}`);
			}
			if (keys.length > 3) {
				console.log(`      ... and ${keys.length - 3} more`);
			}
		}
		console.log();
	}
}

async function showStats(store: TranslationFileStore) {
	const storeData = store.getStore();

	console.log("\nTranslation Statistics:\n");
	console.log(`  Locales: ${storeData.locales.join(", ")}`);
	console.log(`  Namespaces: ${storeData.namespaces.length}`);

	const totalKeys = Object.values(storeData.translations).reduce(
		(sum, ns) => sum + Object.keys(ns).length,
		0,
	);
	console.log(`  Total keys: ${totalKeys}`);

	console.log("\n  Coverage by locale:");
	for (const locale of storeData.locales) {
		let translated = 0;
		let total = 0;
		for (const nsNode of storeData.namespaces) {
			const ns = typeof nsNode === "string" ? nsNode : nsNode.path;
			const nsData = storeData.translations[ns] || {};
			for (const key in nsData) {
				total++;
				const value = nsData[key]?.[locale];
				if (value && value !== "") {
					translated++;
				}
			}
		}
		const coverage = total > 0 ? Math.round((translated / total) * 100) : 0;
		console.log(`    ${locale.toUpperCase()}: ${translated}/${total} (${coverage}%)`);
	}
	console.log();
}

async function showComplete(store: TranslationFileStore) {
	const storeData = store.getStore();
	const completeLocales: string[] = [];

	for (const locale of storeData.locales) {
		let isComplete = true;
		for (const nsNode of storeData.namespaces) {
			const ns = typeof nsNode === "string" ? nsNode : nsNode.path;
			const nsData = storeData.translations[ns] || {};
			for (const key in nsData) {
				if (!nsData[key] || !nsData[key][locale]) {
					isComplete = false;
					break;
				}
			}
			if (!isComplete) break;
		}
		if (isComplete) {
			completeLocales.push(locale);
		}
	}

	console.log("\nComplete locales (100% coverage):");
	if (completeLocales.length === 0) {
		console.log("  None");
	} else {
		for (const locale of completeLocales) {
			console.log(`  ✓ ${locale.toUpperCase()}`);
		}
	}
	console.log();
}

async function listLocales(store: TranslationFileStore) {
	const storeData = store.getStore();
	console.log("\nAvailable locales:");
	if (storeData.locales.length === 0) {
		console.log("  None");
	} else {
		for (const locale of storeData.locales) {
			console.log(`  - ${locale.toUpperCase()}`);
		}
	}
	console.log();
}

async function listKeys(
	store: TranslationFileStore,
	namespace: string | undefined,
	locale: string | undefined,
) {
	const storeData = store.getStore();

	console.log();

	if (namespace && locale) {
		const nsData = storeData.translations[namespace];
		if (!nsData) {
			console.log(`Namespace not found: ${namespace}`);
			process.exit(1);
		}

		console.log(`Keys in ${namespace} (${locale.toUpperCase()}):`);
		const keys = Object.keys(nsData).sort();
		for (const key of keys) {
			const value = nsData[key]?.[locale];
			const status = value ? "✓" : "✗";
			const preview = value
				? `"${value.substring(0, 50)}${value.length > 50 ? "..." : ""}"`
				: "(missing)";
			console.log(`  ${status} ${key}: ${preview}`);
		}
	} else if (namespace) {
		const nsData = storeData.translations[namespace];
		if (!nsData) {
			console.log(`Namespace not found: ${namespace}`);
			process.exit(1);
		}

		console.log(`Keys in ${namespace}:`);
		const keys = Object.keys(nsData).sort();
		for (const key of keys) {
			const locales = storeData.locales.map((l) => (nsData[key]?.[l] ? "✓" : "✗")).join("");
			console.log(`  [${locales}] ${key}`);
		}
	} else {
		console.log("All namespaces:");
		for (const nsNode of storeData.namespaces) {
			const ns = typeof nsNode === "string" ? nsNode : nsNode.path;
			const keyCount = Object.keys(storeData.translations[ns] || {}).length;
			console.log(`  - ${ns} (${keyCount} keys)`);
		}
		console.log("\nUsage:");
		console.log("  rosetta <dir> list-keys <namespace>");
		console.log("  rosetta <dir> list-keys <namespace> --locale=en");
	}

	console.log();
}

async function addLocaleCommand(
	store: TranslationFileStore,
	localeCode: string,
	copyFrom?: string,
) {
	try {
		const success = await store.addLocale(localeCode, copyFrom);
		if (success) {
			console.log(`✓ Added locale: ${localeCode.toUpperCase()}`);
			if (copyFrom) {
				console.log(`  (copied from ${copyFrom.toUpperCase()})`);
			}
		} else {
			console.error(`✗ Failed to add locale ${localeCode}`);
			process.exit(1);
		}
	} catch (err) {
		console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
		process.exit(1);
	}
}
