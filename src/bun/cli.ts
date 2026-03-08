import { TranslationFileStore } from "./store";

type MissingReport = {
	namespace: string;
	locale: string;
	missingKeys: string[];
};

async function runCli() {
	const args = process.argv.slice(2);
	const command = args[0];

	if (!command || command === "help") {
		printUsage();
		process.exit(0);
	}

	const localesDir = args[1] || process.cwd();

	try {
		const store = new TranslationFileStore(localesDir);
		await store.load();

		switch (command) {
			case "missing":
				await showMissing(store);
				break;
			case "stats":
				await showStats(store);
				break;
			case "complete":
				await showComplete(store);
				break;
			default:
				console.error(`Unknown command: ${command}`);
				printUsage();
				process.exit(1);
		}
	} catch (err) {
		console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
		process.exit(1);
	}
}

async function showMissing(store: TranslationFileStore) {
	const storeData = store.getStore();
	const missing: MissingReport[] = [];

	// For each namespace and locale combination, check which keys are missing
	for (const nsNode of storeData.namespaces) {
		const ns = typeof nsNode === "string" ? nsNode : nsNode.path;
		const nsData = storeData.translations[ns] || {};

		for (const locale of storeData.locales) {
			const localeKeys = new Set<string>();

			// Collect all keys present in this locale
			for (const key in nsData) {
				if (nsData[key] && nsData[key][locale]) {
					localeKeys.add(key);
				}
			}

			// Find missing keys
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

	console.log(`\nMissing keys (${missing.length} locale(s) incomplete):\n`);

	// Group by locale for readability
	const byLocale = new Map<string, { ns: string; keys: string[] }[]>();
	for (const report of missing) {
		if (!byLocale.has(report.locale)) {
			byLocale.set(report.locale, []);
		}
		byLocale.get(report.locale)!.push({ ns: report.namespace, keys: report.missingKeys });
	}

	for (const [locale, nsReports] of byLocale.entries()) {
		console.log(`  ${locale.toUpperCase()}`);
		for (const { ns, keys } of nsReports) {
			console.log(`    ${ns}: ${keys.length} missing`);
			for (const key of keys.slice(0, 5)) {
				console.log(`      - ${key}`);
			}
			if (keys.length > 5) {
				console.log(`      ... and ${keys.length - 5} more`);
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
				const value = nsData[key] && nsData[key][locale];
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

function printUsage() {
	console.log(`
Rosetta CLI - Translation Key Explorer

Usage: rosetta <command> [locales-dir]

Commands:
  missing    Show missing keys by locale and namespace
  stats      Show translation coverage statistics
  complete   List locales with 100% coverage
  help       Show this help message

Examples:
  rosetta missing ~/projects/myapp/locales
  rosetta stats
  rosetta complete
`);
}

runCli();
