const RTL_LOCALES = new Set(["ar", "he", "fa", "ur", "ps", "sd", "yi", "ku", "ug", "dv", "syr"]);

export function isRtlLocale(locale: string): boolean {
	return RTL_LOCALES.has(locale.split("-")[0].toLowerCase());
}
