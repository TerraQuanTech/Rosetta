import { dirname, join } from "node:path";
import type { FileSystemAdapter } from "./fs-adapter";
import type { ReviewMap, ReviewToggle } from "./types";

/**
 * Manages review/approval status for translations.
 * Stored in `.rosetta/reviews.json` inside the locales directory.
 */
export class ReviewManager {
	private reviews: ReviewMap = {};
	private filePath = "";
	private fs: FileSystemAdapter;

	constructor(fs: FileSystemAdapter) {
		this.fs = fs;
	}

	setDir(localesDir: string) {
		this.filePath = join(localesDir, ".rosetta", "reviews.json");
	}

	async load(localesDir: string): Promise<ReviewMap> {
		this.setDir(localesDir);
		try {
			const content = await this.fs.readFile(this.filePath);
			this.reviews = JSON.parse(content);
		} catch {
			this.reviews = {};
		}
		return this.reviews;
	}

	get(): ReviewMap {
		return this.reviews;
	}

	async toggle(toggle: ReviewToggle): Promise<boolean> {
		const { namespace, key, locale, reviewed } = toggle;

		if (!this.reviews[namespace]) this.reviews[namespace] = {};
		if (!this.reviews[namespace][key]) this.reviews[namespace][key] = {};

		if (reviewed) {
			this.reviews[namespace][key][locale] = true;
		} else {
			delete this.reviews[namespace][key][locale];
			if (Object.keys(this.reviews[namespace][key]).length === 0) {
				delete this.reviews[namespace][key];
			}
			if (Object.keys(this.reviews[namespace]).length === 0) {
				delete this.reviews[namespace];
			}
		}

		return this.save();
	}

	async clearReview(namespace: string, key: string, locale: string): Promise<void> {
		if (this.reviews[namespace]?.[key]?.[locale]) {
			delete this.reviews[namespace][key][locale];
			if (Object.keys(this.reviews[namespace][key]).length === 0) {
				delete this.reviews[namespace][key];
			}
			if (Object.keys(this.reviews[namespace]).length === 0) {
				delete this.reviews[namespace];
			}
			await this.save();
		}
	}

	private async save(): Promise<boolean> {
		if (!this.filePath) return false;
		try {
			await this.fs.mkdir(dirname(this.filePath));
			await this.fs.writeFile(this.filePath, `${JSON.stringify(this.reviews, null, "\t")}\n`);
			return true;
		} catch (err) {
			console.error("Failed to save reviews:", err);
			return false;
		}
	}
}
