/**
 * Per-character formatting tag system for translation strings.
 *
 * Tags represent DEVIATIONS from the paragraph's base style.
 * If the whole paragraph is bold, no {b} tags appear.
 * If only "hello" is bold in a non-bold paragraph: "{b}hello{/b} world"
 *
 * Supported tags:
 *   {b}...{/b}         bold
 *   {i}...{/i}         italic
 *   {u}...{/u}         underline
 *   {#RRGGBB}...{/}    color
 *   {sz:N}...{/}       font size (points)
 *   {fn:Name}...{/}    font family
 *
 * Escape literal { as \{
 */

export interface CharFormat {
	bold?: boolean;
	italic?: boolean;
	underline?: boolean;
	color?: string;
	fontSize?: number;
	fontFamily?: string;
}

export interface FormattedRun {
	text: string;
	format: CharFormat;
}

export interface BaseStyle {
	bold: boolean;
	italic: boolean;
	underline: boolean;
	color: string;
	fontSize: number;
	fontFamily: string;
}

export function detectBaseStyle(runs: FormattedRun[]): BaseStyle {
	if (runs.length === 0) {
		return { bold: false, italic: false, underline: false, color: "", fontSize: 0, fontFamily: "" };
	}
	// Use the first run's formatting as base (most common in practice)
	const first = runs[0].format;
	return {
		bold: first.bold ?? false,
		italic: first.italic ?? false,
		underline: first.underline ?? false,
		color: first.color ?? "",
		fontSize: first.fontSize ?? 0,
		fontFamily: first.fontFamily ?? "",
	};
}

export function runsToTaggedText(runs: FormattedRun[], base: BaseStyle): string {
	let result = "";

	for (const run of runs) {
		const tags: string[] = [];

		if ((run.format.bold ?? false) !== base.bold) {
			tags.push(run.format.bold ? "{b}" : "{/b}");
		}
		if ((run.format.italic ?? false) !== base.italic) {
			tags.push(run.format.italic ? "{i}" : "{/i}");
		}
		if ((run.format.underline ?? false) !== base.underline) {
			tags.push(run.format.underline ? "{u}" : "{/u}");
		}

		const color = run.format.color ?? "";
		if (color && color !== base.color) {
			tags.push(`{${color}}`);
		}

		const sz = run.format.fontSize ?? 0;
		if (sz && sz !== base.fontSize) {
			tags.push(`{sz:${sz}}`);
		}

		const fn = run.format.fontFamily ?? "";
		if (fn && fn !== base.fontFamily) {
			tags.push(`{fn:${fn}}`);
		}

		const closeTags: string[] = [];
		if (color && color !== base.color) closeTags.push("{/}");
		if (sz && sz !== base.fontSize) closeTags.push("{/}");
		if (fn && fn !== base.fontFamily) closeTags.push("{/}");

		const escapedText = run.text.replace(/\{/g, "\\{");

		if (tags.length === 0) {
			result += escapedText;
		} else {
			result += tags.join("") + escapedText + closeTags.join("");
			// Close toggle tags (b/i/u) by repeating the same tag to toggle back
			for (const tag of tags) {
				if (tag === "{b}" || tag === "{i}" || tag === "{u}") {
					result += `{/${tag[1]}}`;
				}
			}
		}
	}

	return result;
}

interface ParsedSegment {
	text: string;
	bold?: boolean;
	italic?: boolean;
	underline?: boolean;
	color?: string;
	fontSize?: number;
	fontFamily?: string;
}

export function taggedTextToSegments(tagged: string, base: BaseStyle): ParsedSegment[] {
	const segments: ParsedSegment[] = [];

	let bold = base.bold;
	let italic = base.italic;
	let underline = base.underline;
	let color = base.color;
	let fontSize = base.fontSize;
	let fontFamily = base.fontFamily;

	let i = 0;
	let currentText = "";

	function flushText() {
		if (currentText) {
			segments.push({
				text: currentText,
				bold,
				italic,
				underline,
				color: color || undefined,
				fontSize: fontSize || undefined,
				fontFamily: fontFamily || undefined,
			});
			currentText = "";
		}
	}

	while (i < tagged.length) {
		// Escaped brace
		if (tagged[i] === "\\" && tagged[i + 1] === "{") {
			currentText += "{";
			i += 2;
			continue;
		}

		// Tag
		if (tagged[i] === "{") {
			const closeIdx = tagged.indexOf("}", i);
			if (closeIdx === -1) {
				currentText += tagged[i];
				i++;
				continue;
			}

			const tag = tagged.substring(i + 1, closeIdx);
			i = closeIdx + 1;

			flushText();

			if (tag === "b") { bold = true; }
			else if (tag === "/b") { bold = base.bold; }
			else if (tag === "i") { italic = true; }
			else if (tag === "/i") { italic = base.italic; }
			else if (tag === "u") { underline = true; }
			else if (tag === "/u") { underline = base.underline; }
			else if (tag === "/") {
				color = base.color;
				fontSize = base.fontSize;
				fontFamily = base.fontFamily;
			}
			else if (tag.startsWith("#")) { color = tag; }
			else if (tag.startsWith("sz:")) { fontSize = Number.parseFloat(tag.slice(3)); }
			else if (tag.startsWith("fn:")) { fontFamily = tag.slice(3); }
			continue;
		}

		currentText += tagged[i];
		i++;
	}

	flushText();
	return segments;
}

export function stripTags(tagged: string): string {
	return tagged
		.replace(/\\(\{)/g, "\x00ESCAPED_BRACE\x00")
		.replace(/\{[^}]*\}/g, "")
		.replace(/\x00ESCAPED_BRACE\x00/g, "{");
}

export function hasTags(text: string): boolean {
	return /(?<!\\)\{[^}]+\}/.test(text);
}
