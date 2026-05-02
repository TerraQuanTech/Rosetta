import type { BaseStyle, CharFormat, FormattedRun } from "./formatting";
import { detectBaseStyle, hasTags, runsToTaggedText, stripTags, taggedTextToSegments } from "./formatting";
import type { PptxParagraph, PptxRun, PptxShape, PptxSlideData } from "./types";

function cleanShapeName(rawName: string, index: number): string {
	if (/^(Title|Subtitle|Content|Text|Footer|Header|Slide Number|Date)\b/i.test(rawName)) {
		return rawName;
	}
	return `Text ${index + 1}`;
}

export interface ShapeMapping {
	rawName: string;
	cleanName: string;
}

let shapeMappings: Map<string, Map<string, ShapeMapping>> = new Map();

// Store base styles per key for tag deduplication
const baseStyles: Map<string, BaseStyle> = new Map();

function getShapeRawName(namespace: string, cleanName: string): string | null {
	return shapeMappings.get(namespace)?.get(cleanName)?.rawName ?? null;
}

function parseKey(key: string): { cleanName: string; paraIdx: number } | null {
	const match = key.match(/^(.+)\.p(\d+)$/);
	if (!match) return null;
	return { cleanName: match[1], paraIdx: Number.parseInt(match[2], 10) };
}

function namespaceToSlideIndex(namespace: string): number | null {
	const match = namespace.match(/^Slide (\d+)$/);
	if (!match) return null;
	return Number.parseInt(match[1], 10) - 1;
}

function baseStyleKey(ns: string, key: string): string {
	return `${ns}::${key}`;
}

async function readParagraphRuns(
	textRange: PowerPoint.TextRange,
	paraOffset: number,
	paraLength: number,
	context: PowerPoint.RequestContext,
): Promise<FormattedRun[]> {
	if (paraLength === 0) return [];

	// Batch-load font for each character
	const charRanges: PowerPoint.TextRange[] = [];
	for (let c = 0; c < paraLength; c++) {
		const r = textRange.getSubstring(paraOffset + c, 1);
		r.load("text,font/bold,font/italic,font/underline,font/size,font/name,font/color");
		charRanges.push(r);
	}
	await context.sync();

	// Group consecutive characters with same formatting into runs
	const runs: FormattedRun[] = [];
	let currentRun: FormattedRun | null = null;

	for (const r of charRanges) {
		const fmt: CharFormat = {
			bold: r.font.bold ?? undefined,
			italic: r.font.italic ?? undefined,
			underline: r.font.underline !== PowerPoint.ShapeFontUnderlineStyle.none ? true : undefined,
			fontSize: r.font.size ?? undefined,
			fontFamily: r.font.name ?? undefined,
			color: r.font.color ?? undefined,
		};

		if (currentRun && isSameFormat(currentRun.format, fmt)) {
			currentRun.text += r.text;
		} else {
			if (currentRun) runs.push(currentRun);
			currentRun = { text: r.text, format: fmt };
		}
	}
	if (currentRun) runs.push(currentRun);

	return runs;
}

function isSameFormat(a: CharFormat, b: CharFormat): boolean {
	return (
		(a.bold ?? false) === (b.bold ?? false) &&
		(a.italic ?? false) === (b.italic ?? false) &&
		(a.underline ?? false) === (b.underline ?? false) &&
		(a.color ?? "") === (b.color ?? "") &&
		(a.fontSize ?? 0) === (b.fontSize ?? 0) &&
		(a.fontFamily ?? "") === (b.fontFamily ?? "")
	);
}

export async function readAllSlides(): Promise<PptxSlideData[]> {
	const slides: PptxSlideData[] = [];
	shapeMappings = new Map();

	await PowerPoint.run(async (context: PowerPoint.RequestContext) => {
		const slideCollection = context.presentation.slides;
		slideCollection.load("items");
		await context.sync();

		for (let si = 0; si < slideCollection.items.length; si++) {
			const slide = slideCollection.items[si];
			const shapes = slide.shapes;
			shapes.load("items/name,items/id");
			await context.sync();

			const slideShapes: PptxShape[] = [];
			const ns = `Slide ${si + 1}`;
			const nsMap = new Map<string, ShapeMapping>();
			let textShapeIdx = 0;

			for (const shape of shapes.items) {
				let textFrame: PowerPoint.TextFrame;
				try {
					textFrame = shape.textFrame;
					textFrame.load("textRange/text");
					await context.sync();
				} catch {
					continue;
				}

				const fullText = textFrame.textRange.text ?? "";
				if (fullText.trim() === "") continue;

				const cleanName = cleanShapeName(shape.name, textShapeIdx);
				textShapeIdx++;

				nsMap.set(cleanName, { rawName: shape.name, cleanName });

				const rawParas = fullText.split("\r");
				const shapeParagraphs: PptxParagraph[] = [];

				let offset = 0;
				for (let pi = 0; pi < rawParas.length; pi++) {
					const paraText = rawParas[pi];
					if (paraText.trim() === "") {
						offset += paraText.length + 1;
						continue;
					}

					const runs = await readParagraphRuns(textFrame.textRange, offset, paraText.length, context);
					const base = detectBaseStyle(runs);
					const key = `${cleanName}.p${shapeParagraphs.length}`;
					baseStyles.set(baseStyleKey(ns, key), base);

					const taggedText = runsToTaggedText(runs, base);

					const pptxRuns: PptxRun[] = runs.map((r) => ({
						text: r.text,
						bold: r.format.bold,
						italic: r.format.italic,
						underline: r.format.underline,
						fontSize: r.format.fontSize,
						fontFamily: r.format.fontFamily,
						color: r.format.color,
					}));

					shapeParagraphs.push({
						text: taggedText,
						runs: pptxRuns,
					});

					offset += paraText.length + 1;
				}

				if (shapeParagraphs.length > 0) {
					slideShapes.push({
						name: cleanName,
						paragraphs: shapeParagraphs,
					});
				}
			}

			shapeMappings.set(ns, nsMap);
			slides.push({ index: si, name: ns, shapes: slideShapes });
		}
	});

	return slides;
}

export async function applyTranslation(
	namespace: string,
	key: string,
	value: string,
): Promise<boolean> {
	const slideIdx = namespaceToSlideIndex(namespace);
	if (slideIdx === null) return false;

	const parsed = parseKey(key);
	if (!parsed) return false;

	const rawName = getShapeRawName(namespace, parsed.cleanName);
	if (!rawName) return false;

	try {
		await PowerPoint.run(async (context: PowerPoint.RequestContext) => {
			const slides = context.presentation.slides;
			slides.load("items");
			await context.sync();

			if (slideIdx >= slides.items.length) return;

			const slide = slides.items[slideIdx];
			const shapes = slide.shapes;
			shapes.load("items/name");
			await context.sync();

			const shape = shapes.items.find((s: PowerPoint.Shape) => s.name === rawName);
			if (!shape) return;

			const textFrame = shape.textFrame;
			textFrame.load("textRange/text");
			await context.sync();

			const fullText = textFrame.textRange.text ?? "";
			const paras = fullText.split("\r");

			if (parsed.paraIdx >= paras.length) return;

			let offset = 0;
			for (let i = 0; i < parsed.paraIdx; i++) {
				offset += paras[i].length + 1;
			}

			const plainValue = stripTags(value).replace(/\n/g, "\r");
			const paraRange = textFrame.textRange.getSubstring(offset, paras[parsed.paraIdx].length);
			paraRange.text = plainValue;
			await context.sync();

			// If the value has formatting tags, apply them
			if (hasTags(value)) {
				const bsKey = baseStyleKey(namespace, key);
				const base = baseStyles.get(bsKey) ?? {
					bold: false, italic: false, underline: false,
					color: "", fontSize: 0, fontFamily: "",
				};

				const segments = taggedTextToSegments(value, base);

				// Re-load the range since text length may have changed
				textFrame.load("textRange/text");
				await context.sync();

				// Recalculate offset after text replacement
				const newFullText = textFrame.textRange.text ?? "";
				const newParas = newFullText.split("\r");
				let newOffset = 0;
				for (let i = 0; i < parsed.paraIdx; i++) {
					newOffset += newParas[i].length + 1;
				}

				let segOffset = 0;
				for (const seg of segments) {
					if (seg.text.length === 0) continue;

					const segRange = textFrame.textRange.getSubstring(
						newOffset + segOffset,
						seg.text.length,
					);

					if (seg.bold !== undefined) segRange.font.bold = seg.bold;
					if (seg.italic !== undefined) segRange.font.italic = seg.italic;
					if (seg.underline !== undefined) {
						segRange.font.underline = seg.underline
							? PowerPoint.ShapeFontUnderlineStyle.single
							: PowerPoint.ShapeFontUnderlineStyle.none;
					}
					if (seg.color) segRange.font.color = seg.color;
					if (seg.fontSize) segRange.font.size = seg.fontSize;
					if (seg.fontFamily) segRange.font.name = seg.fontFamily;

					segOffset += seg.text.length;
				}

				await context.sync();
			}
		});
		return true;
	} catch {
		return false;
	}
}

export async function getSelectedShapeInfo(): Promise<{
	namespace: string;
	key: string;
} | null> {
	let result: { namespace: string; key: string } | null = null;

	try {
		await PowerPoint.run(async (context: PowerPoint.RequestContext) => {
			const selection = context.presentation.getSelectedSlides();
			selection.load("items");
			await context.sync();

			if (selection.items.length === 0) return;

			const slides = context.presentation.slides;
			slides.load("items/id");
			await context.sync();

			const selectedSlideId = selection.items[0].id;
			const slideIdx = slides.items.findIndex((s: PowerPoint.Slide) => s.id === selectedSlideId);
			if (slideIdx === -1) return;

			const ns = `Slide ${slideIdx + 1}`;
			const shapes = slides.items[slideIdx].shapes;
			shapes.load("items/name,items/id");
			await context.sync();

			const selectedShapes = context.presentation.getSelectedShapes();
			selectedShapes.load("items/id");
			await context.sync();

			if (selectedShapes.items.length === 0) return;

			const selectedShapeId = selectedShapes.items[0].id;
			const shape = shapes.items.find((s: PowerPoint.Shape) => s.id === selectedShapeId);
			if (!shape) return;

			const nsMap = shapeMappings.get(ns);
			let cleanName = shape.name;
			if (nsMap) {
				for (const mapping of nsMap.values()) {
					if (mapping.rawName === shape.name) {
						cleanName = mapping.cleanName;
						break;
					}
				}
			}

			result = { namespace: ns, key: `${cleanName}.p0` };
		});
	} catch {}

	return result;
}
