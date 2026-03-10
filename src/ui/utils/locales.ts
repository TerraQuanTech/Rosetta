export interface LocaleInfo {
	code: string;
	name: string;
	nativeName: string;
	flag: string;
	region?: string;
}

export const KNOWN_LOCALES: LocaleInfo[] = [
	{ code: "en", name: "English", nativeName: "English", flag: "🇬🇧", region: "GB" },
	{ code: "en-US", name: "English (US)", nativeName: "English", flag: "🇺🇸", region: "US" },
	{ code: "en-GB", name: "English (UK)", nativeName: "English", flag: "🇬🇧", region: "GB" },
	{ code: "es", name: "Spanish", nativeName: "Español", flag: "🇪🇸", region: "ES" },
	{ code: "es-MX", name: "Spanish (Mexico)", nativeName: "Español", flag: "🇲🇽", region: "MX" },
	{ code: "fr", name: "French", nativeName: "Français", flag: "🇫🇷", region: "FR" },
	{ code: "fr-CA", name: "French (Canada)", nativeName: "Français", flag: "🇨🇦", region: "CA" },
	{ code: "de", name: "German", nativeName: "Deutsch", flag: "🇩🇪", region: "DE" },
	{ code: "it", name: "Italian", nativeName: "Italiano", flag: "🇮🇹", region: "IT" },
	{ code: "pt", name: "Portuguese", nativeName: "Português", flag: "🇵🇹", region: "PT" },
	{ code: "pt-BR", name: "Portuguese (Brazil)", nativeName: "Português", flag: "🇧🇷", region: "BR" },
	{ code: "nl", name: "Dutch", nativeName: "Nederlands", flag: "🇳🇱", region: "NL" },
	{ code: "pl", name: "Polish", nativeName: "Polski", flag: "🇵🇱", region: "PL" },
	{ code: "ru", name: "Russian", nativeName: "Русский", flag: "🇷🇺", region: "RU" },
	{ code: "ja", name: "Japanese", nativeName: "日本語", flag: "🇯🇵", region: "JP" },
	{ code: "ko", name: "Korean", nativeName: "한국어", flag: "🇰🇷", region: "KR" },
	{ code: "zh", name: "Chinese", nativeName: "中文", flag: "🇨🇳", region: "CN" },
	{
		code: "zh-TW",
		name: "Chinese (Traditional)",
		nativeName: "繁體中文",
		flag: "🇹🇼",
		region: "TW",
	},
	{ code: "ar", name: "Arabic", nativeName: "العربية", flag: "🇸🇦", region: "SA" },
	{ code: "he", name: "Hebrew", nativeName: "עברית", flag: "🇮🇱", region: "IL" },
	{ code: "tr", name: "Turkish", nativeName: "Türkçe", flag: "🇹🇷", region: "TR" },
	{ code: "sv", name: "Swedish", nativeName: "Svenska", flag: "🇸🇪", region: "SE" },
	{ code: "da", name: "Danish", nativeName: "Dansk", flag: "🇩🇰", region: "DK" },
	{ code: "no", name: "Norwegian", nativeName: "Norsk", flag: "🇳🇴", region: "NO" },
	{ code: "fi", name: "Finnish", nativeName: "Suomi", flag: "🇫🇮", region: "FI" },
	{ code: "el", name: "Greek", nativeName: "Ελληνικά", flag: "🇬🇷", region: "GR" },
	{ code: "cs", name: "Czech", nativeName: "Čeština", flag: "🇨🇿", region: "CZ" },
	{ code: "sk", name: "Slovak", nativeName: "Slovenčina", flag: "🇸🇰", region: "SK" },
	{ code: "hu", name: "Hungarian", nativeName: "Magyar", flag: "🇭🇺", region: "HU" },
	{ code: "ro", name: "Romanian", nativeName: "Română", flag: "🇷🇴", region: "RO" },
	{ code: "uk", name: "Ukrainian", nativeName: "Українська", flag: "🇺🇦", region: "UA" },
	{ code: "vi", name: "Vietnamese", nativeName: "Tiếng Việt", flag: "🇻🇳", region: "VN" },
	{ code: "th", name: "Thai", nativeName: "ไทย", flag: "🇹🇭", region: "TH" },
	{ code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia", flag: "🇮🇩", region: "ID" },
	{ code: "ms", name: "Malay", nativeName: "Bahasa Melayu", flag: "🇲🇾", region: "MY" },
	{ code: "hi", name: "Hindi", nativeName: "हिन्दी", flag: "🇮🇳", region: "IN" },
	{ code: "bn", name: "Bengali", nativeName: "বাংলা", flag: "🇧🇩", region: "BD" },
	{ code: "fa", name: "Persian", nativeName: "فارسی", flag: "🇮🇷", region: "IR" },
	{ code: "ur", name: "Urdu", nativeName: "اردو", flag: "🇵🇰", region: "PK" },
	{ code: "ta", name: "Tamil", nativeName: "தமிழ்", flag: "🇱🇰", region: "LK" },
	{ code: "ml", name: "Malayalam", nativeName: "മലയാളം", flag: "🇮🇳", region: "IN" },
	{ code: "te", name: "Telugu", nativeName: "తెలుగు", flag: "🇮🇳", region: "IN" },
	{ code: "mr", name: "Marathi", nativeName: "मराठी", flag: "🇮🇳", region: "IN" },
	{ code: "gu", name: "Gujarati", nativeName: "ગુજરાતી", flag: "🇮🇳", region: "IN" },
	{ code: "kn", name: "Kannada", nativeName: "ಕನ್ನಡ", flag: "🇮🇳", region: "IN" },
	{ code: "pa", name: "Punjabi", nativeName: "ਪੰਜਾਬੀ", flag: "🇮🇳", region: "IN" },
	{ code: "ca", name: "Catalan", nativeName: "Català", flag: "🇪🇸", region: "ES" },
	{ code: "eu", name: "Basque", nativeName: "Euskara", flag: "🇪🇸", region: "ES" },
	{ code: "gl", name: "Galician", nativeName: "Galego", flag: "🇪🇸", region: "ES" },
	{ code: "hr", name: "Croatian", nativeName: "Hrvatski", flag: "🇭🇷", region: "HR" },
	{ code: "sr", name: "Serbian", nativeName: "Српски", flag: "🇷🇸", region: "RS" },
	{ code: "sl", name: "Slovenian", nativeName: "Slovenščina", flag: "🇸🇮", region: "SI" },
	{ code: "bg", name: "Bulgarian", nativeName: "Български", flag: "🇧🇬", region: "BG" },
	{ code: "lt", name: "Lithuanian", nativeName: "Lietuvių", flag: "🇱🇹", region: "LT" },
	{ code: "lv", name: "Latvian", nativeName: "Latviešu", flag: "🇱🇻", region: "LV" },
	{ code: "et", name: "Estonian", nativeName: "Eesti", flag: "🇪🇪", region: "EE" },
	{ code: "ka", name: "Georgian", nativeName: "ქართული", flag: "🇬🇪", region: "GE" },
	{ code: "hy", name: "Armenian", nativeName: "Հայերեն", flag: "🇦🇲", region: "AM" },
	{ code: "az", name: "Azerbaijani", nativeName: "Azərbaycan", flag: "🇦🇿", region: "AZ" },
	{ code: "kk", name: "Kazakh", nativeName: "Қазақ", flag: "🇰🇿", region: "KZ" },
	{ code: "uz", name: "Uzbek", nativeName: "O'zbek", flag: "🇺🇿", region: "UZ" },
	{ code: "mn", name: "Mongolian", nativeName: "Монгол", flag: "🇲🇳", region: "MN" },
	{ code: "ne", name: "Nepali", nativeName: "नेपाली", flag: "🇳🇵", region: "NP" },
	{ code: "si", name: "Sinhala", nativeName: "සිංහල", flag: "🇱🇰", region: "LK" },
	{ code: "km", name: "Khmer", nativeName: "ខ្មែរ", flag: "🇰🇭", region: "KH" },
	{ code: "lo", name: "Lao", nativeName: "ລາວ", flag: "🇱🇦", region: "LA" },
	{ code: "my", name: "Burmese", nativeName: "မြန်မာ", flag: "🇲🇲", region: "MM" },
	{ code: "am", name: "Amharic", nativeName: "አማርኛ", flag: "🇪🇹", region: "ET" },
	{ code: "sw", name: "Swahili", nativeName: "Kiswahili", flag: "🇰🇪", region: "KE" },
	{ code: "af", name: "Afrikaans", nativeName: "Afrikaans", flag: "🇿🇦", region: "ZA" },
	{ code: "mk", name: "Macedonian", nativeName: "Македонски", flag: "🇲🇰", region: "MK" },
	{ code: "mt", name: "Maltese", nativeName: "Malti", flag: "🇲🇹", region: "MT" },
	{ code: "cy", name: "Welsh", nativeName: "Cymraeg", flag: "🏴󠁧󠁢󠁷󠁬󠁳󠁿", region: "GB" },
	{ code: "ga", name: "Irish", nativeName: "Gaeilge", flag: "🇮🇪", region: "IE" },
	{ code: "is", name: "Icelandic", nativeName: "Íslenska", flag: "🇮🇸", region: "IS" },
	{ code: "lb", name: "Luxembourgish", nativeName: "Lëtzebuergesch", flag: "🇱🇺", region: "LU" },
	{ code: "be", name: "Belarusian", nativeName: "Беларуская", flag: "🇧🇾", region: "BY" },
	{ code: "tg", name: "Tajik", nativeName: "Тоҷикӣ", flag: "🇹🇯", region: "TJ" },
	{ code: "tk", name: "Turkmen", nativeName: "Türkmen", flag: "🇹🇲", region: "TM" },
	{ code: "ky", name: "Kyrgyz", nativeName: "Кыргыз", flag: "🇰🇬", region: "KG" },
	{ code: "ps", name: "Pashto", nativeName: "پښتو", flag: "🇦🇫", region: "AF" },
	{ code: "sd", name: "Sindhi", nativeName: "سنڌي", flag: "🇵🇰", region: "PK" },
	{ code: "dv", name: "Divehi", nativeName: "Divehi", flag: "🇲🇻", region: "MV" },
	{ code: "ku", name: "Kurdish", nativeName: "Kurdî", flag: "🇮🇶", region: "IQ" },
	{ code: "ckb", name: "Sorani", nativeName: "سۆرانی", flag: "🇮🇶", region: "IQ" },
];

export const LOCALE_CODE_MAP: Record<string, LocaleInfo> = Object.fromEntries(
	KNOWN_LOCALES.map((locale) => [locale.code, locale]),
);

export function getLocaleInfo(code: string): LocaleInfo | undefined {
	return LOCALE_CODE_MAP[code];
}

export function searchLocales(query: string, existingLocales: string[] = []): LocaleInfo[] {
	const q = query.toLowerCase().trim();
	if (!q) return [];

	const existingSet = new Set(existingLocales);

	const results: LocaleInfo[] = [];

	const added = new Set<string>();

	if (q.length === 2) {
		const baseInfo = KNOWN_LOCALES.find((l) => l.code === q);
		if (baseInfo && !existingSet.has(baseInfo.code)) {
			results.push(baseInfo);
			added.add(baseInfo.code);
		}
		for (const locale of KNOWN_LOCALES) {
			if (
				locale.code.startsWith(`${q}-`) &&
				!existingSet.has(locale.code) &&
				!added.has(locale.code)
			) {
				results.push(locale);
				added.add(locale.code);
			}
		}
	}

	for (const locale of KNOWN_LOCALES) {
		if (added.has(locale.code)) continue;
		if (existingSet.has(locale.code)) continue;

		const codeMatch = locale.code.toLowerCase().includes(q);
		const nameMatch = locale.name.toLowerCase().includes(q);
		const nativeMatch = locale.nativeName.toLowerCase().includes(q);

		if (codeMatch || nameMatch || nativeMatch) {
			results.push(locale);
		}
	}

	return results.slice(0, 8);
}
