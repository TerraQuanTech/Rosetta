import type { PptxSlideData } from "./types";

const META_KEY = "ROSETTA_META";
const TRANSLATIONS_KEY = "ROSETTA_TRANSLATIONS";

interface RosettaMeta {
	sourceLocale: string;
	locales: string[];
}

type SlideTranslations = Record<string, Record<string, string>>;

export async function saveTranslations(
	locales: string[],
	sourceLocale: string,
	translations: Record<string, SlideTranslations>,
): Promise<void> {
	await PowerPoint.run(async (context: PowerPoint.RequestContext) => {
		const slides = context.presentation.slides;
		slides.load("items");
		await context.sync();

		// Save meta on first slide's tags
		if (slides.items.length > 0) {
			const meta: RosettaMeta = { sourceLocale, locales };
			slides.items[0].tags.add(META_KEY, JSON.stringify(meta));
		}

		// Save per-slide translations
		for (let i = 0; i < slides.items.length; i++) {
			const ns = `Slide ${i + 1}`;
			const slideData = translations[ns];
			if (slideData) {
				slides.items[i].tags.add(TRANSLATIONS_KEY, JSON.stringify(slideData));
			}
		}

		await context.sync();
	});
}

export async function loadTranslations(): Promise<{
	meta: RosettaMeta | null;
	translations: Record<string, SlideTranslations>;
}> {
	let meta: RosettaMeta | null = null;
	const translations: Record<string, SlideTranslations> = {};

	await PowerPoint.run(async (context: PowerPoint.RequestContext) => {
		const slides = context.presentation.slides;
		slides.load("items");
		await context.sync();

		for (let i = 0; i < slides.items.length; i++) {
			const tags = slides.items[i].tags;
			tags.load("items/key,items/value");
			await context.sync();

			for (const tag of tags.items) {
				if (tag.key === META_KEY && i === 0) {
					try {
						meta = JSON.parse(tag.value);
					} catch {}
				}
				if (tag.key === TRANSLATIONS_KEY) {
					try {
						translations[`Slide ${i + 1}`] = JSON.parse(tag.value);
					} catch {}
				}
			}
		}
	});

	return { meta, translations };
}

export async function saveUpdate(
	namespace: string,
	key: string,
	locale: string,
	value: string,
): Promise<void> {
	const slideMatch = namespace.match(/^Slide (\d+)$/);
	if (!slideMatch) return;
	const slideIdx = Number.parseInt(slideMatch[1], 10) - 1;

	await PowerPoint.run(async (context: PowerPoint.RequestContext) => {
		const slides = context.presentation.slides;
		slides.load("items");
		await context.sync();

		if (slideIdx >= slides.items.length) return;

		const slide = slides.items[slideIdx];
		const tags = slide.tags;
		tags.load("items/key,items/value");
		await context.sync();

		let existing: SlideTranslations = {};
		for (const tag of tags.items) {
			if (tag.key === TRANSLATIONS_KEY) {
				try {
					existing = JSON.parse(tag.value);
				} catch {}
				break;
			}
		}

		if (!existing[key]) {
			existing[key] = {};
		}
		existing[key][locale] = value;

		tags.add(TRANSLATIONS_KEY, JSON.stringify(existing));
		await context.sync();
	});
}

export async function saveLocales(locales: string[], sourceLocale: string): Promise<void> {
	await PowerPoint.run(async (context: PowerPoint.RequestContext) => {
		const slides = context.presentation.slides;
		slides.load("items");
		await context.sync();

		if (slides.items.length > 0) {
			const meta: RosettaMeta = { sourceLocale, locales };
			slides.items[0].tags.add(META_KEY, JSON.stringify(meta));
			await context.sync();
		}
	});
}
