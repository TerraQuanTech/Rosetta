export interface PptxRun {
	text: string;
	bold?: boolean;
	italic?: boolean;
	underline?: boolean;
	fontSize?: number;
	fontFamily?: string;
	color?: string;
}

export interface PptxParagraph {
	text: string;
	runs: PptxRun[];
	alignment?: "left" | "center" | "right" | "justify";
}

export interface PptxShape {
	name: string;
	paragraphs: PptxParagraph[];
}

export interface PptxSlideData {
	index: number;
	name: string;
	shapes: PptxShape[];
}

export interface PptxSyncMessage {
	type: "pptx:sync";
	sourceLocale: string;
	slides: PptxSlideData[];
	savedTranslations?: Record<string, Record<string, Record<string, string>>>;
	savedLocales?: string[];
}

export interface HelloMessage {
	type: "hello";
	appName: string;
}

export interface KeyFocusMessage {
	type: "key:focus";
	namespace: string;
	key: string;
}

export interface TranslationUpdateMessage {
	type: "translation:update";
	namespace: string;
	key: string;
	locale: string;
	value: string;
}

export interface TranslationReloadMessage {
	type: "translation:reload";
	namespace: string;
	locale: string;
}

export interface PptxLocalesMessage {
	type: "pptx:locales";
	locales: string[];
	sourceLocale: string;
}

export type OutgoingMessage = PptxSyncMessage | HelloMessage | KeyFocusMessage;
export type IncomingMessage = TranslationUpdateMessage | TranslationReloadMessage | PptxLocalesMessage;
