import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { ReviewMap, ReviewToggle } from "../shared/types";

/**
 * Manages review/approval status for translations.
 * Stored in `.rosetta/reviews.json` inside the locales directory.
 */
export class ReviewManager {
	private reviews: ReviewMap = {};
	private filePath = "";

	setDir(localesDir: string) {
		this.filePath = join(localesDir, ".rosetta", "reviews.json");
	}

	async load(localesDir: string): Promise<ReviewMap> {
		this.setDir(localesDir);
		try {
			const content = await readFile(this.filePath, "utf-8");
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
			// Clean up empty objects
			if (Object.keys(this.reviews[namespace][key]).length === 0) {
				delete this.reviews[namespace][key];
			}
			if (Object.keys(this.reviews[namespace]).length === 0) {
				delete this.reviews[namespace];
			}
		}

		return this.save();
	}

	/** Clear review status for a specific key+locale (called when value changes) */
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
			await mkdir(dirname(this.filePath), { recursive: true });
			await writeFile(this.filePath, `${JSON.stringify(this.reviews, null, "\t")}\n`, "utf-8");
			return true;
		} catch (err) {
			console.error("Failed to save reviews:", err);
			return false;
		}
	}
}
