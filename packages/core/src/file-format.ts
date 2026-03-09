export interface FileFormat {
	indent: string;
	trailingNewline: boolean;
}

export function stripBOM(content: string): string {
	return content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
}

export function detectFormat(content: string): FileFormat {
	const trailingNewline = content.endsWith("\n");

	const lines = content.split("\n");
	for (const line of lines) {
		const match = line.match(/^(\s+)\S/);
		if (!match) {
			continue;
		}

		const whitespace = match[1];
		if (whitespace[0] === "\t") {
			return { indent: "\t", trailingNewline };
		}
		return { indent: whitespace, trailingNewline };
	}

	return { indent: "    ", trailingNewline: true };
}
