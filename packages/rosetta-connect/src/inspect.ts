import type { i18n } from "i18next";

export interface InspectOptions {
	/** Key for the keyboard shortcut to toggle inspect mode. Default: "i" (used with Cmd/Ctrl) */
	toggleKey?: string;
	/** Start with inspect mode active. Default: false */
	startActive?: boolean;
}

interface TranslationRef {
	namespace: string;
	key: string;
}

const ATTR_NS = "data-rosetta-ns";
const ATTR_KEY = "data-rosetta-key";
const WRAPPER_TAG = "rosetta-i18n";
const STYLE_ID = "rosetta-inspect-styles";
const MENU_ID = "rosetta-inspect-menu";

/**
 * Enable inspect mode: highlights i18n-provided text in the DOM and adds
 * a context menu to jump to keys in Rosetta.
 *
 * Hooks into i18next.t() to track which translated strings map to which
 * namespace/key, then uses a MutationObserver to annotate matching DOM
 * text nodes.
 *
 * @returns A cleanup function that removes all instrumentation
 */
export function enableInspect(
	i18next: i18n,
	sendFocusKey: (namespace: string, key: string) => void,
	options: InspectOptions = {},
): () => void {
	const { toggleKey = "i", startActive = false } = options;

	// Map of rendered text → translation reference
	const textToRef = new Map<string, TranslationRef>();
	let active = startActive;
	let observer: MutationObserver | null = null;

	// --- 0. Pre-populate map from already-loaded resources ---
	function populateFromResources() {
		const storeData = (i18next.store as any)?.data;
		if (!storeData) return;

		// Walk current language + fallbacks
		const langs = i18next.languages || [i18next.language].filter(Boolean);
		for (const lang of langs) {
			const langData = storeData[lang];
			if (!langData) continue;
			for (const [ns, bundle] of Object.entries(langData)) {
				if (typeof bundle !== "object" || !bundle) continue;
				walkBundle(ns, "", bundle as Record<string, unknown>);
			}
		}
	}

	function walkBundle(ns: string, prefix: string, obj: Record<string, unknown>) {
		for (const [k, v] of Object.entries(obj)) {
			const fullKey = prefix ? `${prefix}.${k}` : k;
			if (typeof v === "string" && v.length > 0) {
				textToRef.set(v, { namespace: ns, key: fullKey });
			} else if (typeof v === "object" && v !== null) {
				walkBundle(ns, fullKey, v as Record<string, unknown>);
			}
		}
	}

	populateFromResources();

	// Re-populate when i18next loads new namespaces or changes language
	const repopulateAndRescan = () => {
		populateFromResources();
		if (active) scanNode(document.body);
	};
	i18next.on("loaded", repopulateAndRescan);
	i18next.on("languageChanged", repopulateAndRescan);

	// --- 1. PostProcessor plugin to intercept ALL t() calls (including getFixedT/useTranslation) ---
	const POST_PROCESSOR_NAME = "rosetta-inspect";

	const postProcessor = {
		type: "postProcessor" as const,
		name: POST_PROCESSOR_NAME,
		process(value: string, keys: string[], options: Record<string, any>) {
			if (typeof value === "string" && value.length > 0 && keys.length > 0) {
				const rawKey = keys[0];
				let ns: string | undefined;
				let key: string;

				// Parse "ns:key" format
				const nsSep = i18next.options?.nsSeparator ?? ":";
				if (typeof nsSep === "string" && rawKey.includes(nsSep)) {
					const idx = rawKey.indexOf(nsSep);
					ns = rawKey.slice(0, idx);
					key = rawKey.slice(idx + nsSep.length);
				} else {
					key = rawKey;
				}

				// Resolve namespace from options or defaults
				if (!ns) {
					if (options?.ns) {
						ns = String(Array.isArray(options.ns) ? options.ns[0] : options.ns);
					} else {
						const defaultNs = i18next.options?.defaultNS;
						ns = String((Array.isArray(defaultNs) ? defaultNs[0] : defaultNs) || "translation");
					}
				}

				textToRef.set(value, { namespace: ns, key });
			}
			return value;
		},
	};

	i18next.use(postProcessor);
	// Enable the post-processor globally
	const existingPP = i18next.options?.postProcess;
	const ppList = Array.isArray(existingPP) ? existingPP : existingPP ? [existingPP] : [];
	if (!ppList.includes(POST_PROCESSOR_NAME)) {
		ppList.push(POST_PROCESSOR_NAME);
	}
	(i18next.options as any).postProcess = ppList;

	// --- 2. CSS injection ---
	function injectStyles() {
		if (document.getElementById(STYLE_ID)) return;
		const style = document.createElement("style");
		style.id = STYLE_ID;
		style.textContent = `
			${WRAPPER_TAG} {
				position: relative;
				border-radius: 3px;
				cursor: pointer;
				transition: background-color 0.15s;
			}
			${WRAPPER_TAG}::after {
				content: '';
				position: absolute;
				inset: -2px;
				border-radius: 4px;
				background: conic-gradient(#f44, #f90, #ee0, #4c4, #48f, #c4f, #f44);
				-webkit-mask:
					linear-gradient(#000 0 0) content-box,
					linear-gradient(#000 0 0);
				-webkit-mask-composite: xor;
				mask:
					linear-gradient(#000 0 0) content-box,
					linear-gradient(#000 0 0);
				mask-composite: exclude;
				padding: 1.5px;
				pointer-events: none;
			}
			${WRAPPER_TAG}:hover {
				background-color: rgba(200, 160, 255, 0.08);
			}
			#${MENU_ID} {
				position: fixed;
				z-index: 2147483647;
				background: #1c1c20;
				border: 1px solid #3a3a42;
				border-radius: 6px;
				padding: 4px;
				box-shadow: 0 4px 16px rgba(0,0,0,0.3);
				font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
				font-size: 13px;
				min-width: 180px;
			}
			#${MENU_ID} button {
				display: block;
				width: 100%;
				padding: 6px 12px;
				background: none;
				border: none;
				color: #efefef;
				text-align: left;
				border-radius: 4px;
				cursor: pointer;
				font: inherit;
			}
			#${MENU_ID} button:hover {
				background: #303036;
			}
			#${MENU_ID} .rosetta-menu-label {
				color: #78787f;
				font-size: 11px;
				padding: 4px 12px 2px;
				pointer-events: none;
			}
		`;
		document.head.appendChild(style);
	}

	function removeStyles() {
		document.getElementById(STYLE_ID)?.remove();
	}

	// --- 3. DOM scanning ---
	function isIgnoredElement(el: Element): boolean {
		const tag = el.tagName;
		return tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT" || tag === "TEMPLATE";
	}

	function wrapTextNode(textNode: Text) {
		const text = textNode.textContent?.trim();
		if (!text) return;

		// Already wrapped
		const parent = textNode.parentElement;
		if (parent?.tagName === WRAPPER_TAG.toUpperCase()) return;

		// Exact match — wrap the whole node
		const ref = textToRef.get(text);
		if (ref) {
			const wrapper = document.createElement(WRAPPER_TAG);
			wrapper.setAttribute(ATTR_NS, ref.namespace);
			wrapper.setAttribute(ATTR_KEY, ref.key);
			textNode.parentNode?.insertBefore(wrapper, textNode);
			wrapper.appendChild(textNode);
			return;
		}

		// Substring match — find translated fragments inside mixed text
		// (e.g. "42.1234 МГц" contains translated unit "МГц")
		wrapSubstrings(textNode, text);
	}

	function wrapSubstrings(textNode: Text, text: string) {
		// Find all translation values that appear as substrings, pick the longest matches
		const matches: Array<{ start: number; end: number; ref: TranslationRef }> = [];
		for (const [value, ref] of textToRef) {
			if (value.length < 2) continue; // skip single-char matches
			let idx = text.indexOf(value);
			while (idx !== -1) {
				matches.push({ start: idx, end: idx + value.length, ref });
				idx = text.indexOf(value, idx + 1);
			}
		}
		if (matches.length === 0) return;

		// Sort by start position, then prefer longer matches
		matches.sort((a, b) => a.start - b.start || b.end - a.end);

		// Remove overlapping matches (keep longest/earliest)
		const filtered: typeof matches = [];
		let lastEnd = 0;
		for (const m of matches) {
			if (m.start >= lastEnd) {
				filtered.push(m);
				lastEnd = m.end;
			}
		}

		// Split the text node and wrap matched portions
		const parentNode = textNode.parentNode;
		if (!parentNode) return;

		let currentNode: Text = textNode;
		let offset = 0;
		for (const m of filtered) {
			// Split off any text before the match
			if (m.start > offset) {
				currentNode = currentNode.splitText(m.start - offset);
				offset = m.start;
			}
			// Split off the matched portion
			const afterMatch = currentNode.splitText(m.end - offset);
			const matchedNode = currentNode;
			offset = m.end;
			currentNode = afterMatch;

			// Wrap the matched text node
			const wrapper = document.createElement(WRAPPER_TAG);
			wrapper.setAttribute(ATTR_NS, m.ref.namespace);
			wrapper.setAttribute(ATTR_KEY, m.ref.key);
			parentNode.insertBefore(wrapper, matchedNode);
			wrapper.appendChild(matchedNode);
		}
	}

	function scanNode(root: Node) {
		const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
			acceptNode(node) {
				const parent = node.parentElement;
				if (!parent) return NodeFilter.FILTER_REJECT;
				if (isIgnoredElement(parent)) return NodeFilter.FILTER_REJECT;
				if (parent.tagName === WRAPPER_TAG.toUpperCase()) return NodeFilter.FILTER_SKIP;
				if (!node.textContent?.trim()) return NodeFilter.FILTER_SKIP;
				return NodeFilter.FILTER_ACCEPT;
			},
		});

		const nodes: Text[] = [];
		while (walker.nextNode()) {
			nodes.push(walker.currentNode as Text);
		}
		for (const node of nodes) {
			wrapTextNode(node);
		}
	}

	function unwrapAll() {
		for (const el of document.querySelectorAll(WRAPPER_TAG)) {
			const parent = el.parentNode;
			if (!parent) continue;
			while (el.firstChild) {
				parent.insertBefore(el.firstChild, el);
			}
			parent.removeChild(el);
		}
	}

	function startObserver() {
		scanNode(document.body);

		observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				if (mutation.type === "characterData" && mutation.target.nodeType === Node.TEXT_NODE) {
					wrapTextNode(mutation.target as Text);
					continue;
				}
				for (const node of mutation.addedNodes) {
					if (node.nodeType === Node.TEXT_NODE) {
						wrapTextNode(node as Text);
					} else if (node.nodeType === Node.ELEMENT_NODE) {
						scanNode(node);
					}
				}
			}
		});

		observer.observe(document.body, {
			childList: true,
			subtree: true,
			characterData: true,
		});
	}

	function stopObserver() {
		observer?.disconnect();
		observer = null;
		unwrapAll();
	}

	// --- 4. Context menu ---
	function showContextMenu(e: MouseEvent, ns: string, key: string) {
		e.preventDefault();
		e.stopPropagation();

		hideContextMenu();

		const menu = document.createElement("div");
		menu.id = MENU_ID;
		menu.style.left = `${e.clientX}px`;
		menu.style.top = `${e.clientY}px`;

		const label = document.createElement("div");
		label.className = "rosetta-menu-label";
		label.textContent = `${ns}:${key}`;
		menu.appendChild(label);

		const focusBtn = document.createElement("button");
		focusBtn.textContent = "Open in Rosetta";
		focusBtn.addEventListener("click", () => {
			sendFocusKey(ns, key);
			hideContextMenu();
		});
		menu.appendChild(focusBtn);

		const copyBtn = document.createElement("button");
		copyBtn.textContent = "Copy key path";
		copyBtn.addEventListener("click", () => {
			navigator.clipboard.writeText(`${ns}:${key}`);
			hideContextMenu();
		});
		menu.appendChild(copyBtn);

		document.body.appendChild(menu);

		// Reposition if off-screen
		const rect = menu.getBoundingClientRect();
		if (rect.right > window.innerWidth) {
			menu.style.left = `${window.innerWidth - rect.width - 8}px`;
		}
		if (rect.bottom > window.innerHeight) {
			menu.style.top = `${window.innerHeight - rect.height - 8}px`;
		}

		// Close on next click
		setTimeout(() => {
			document.addEventListener("click", hideContextMenu, { once: true });
			document.addEventListener("contextmenu", hideContextMenu, { once: true });
		}, 0);
	}

	function hideContextMenu() {
		document.getElementById(MENU_ID)?.remove();
	}

	function handleContextMenu(e: MouseEvent) {
		const target = (e.target as Element)?.closest?.(WRAPPER_TAG);
		if (!target) return;
		const ns = target.getAttribute(ATTR_NS);
		const key = target.getAttribute(ATTR_KEY);
		if (ns && key) {
			showContextMenu(e, ns, key);
		}
	}

	// --- 5. Toggle with Meta/Ctrl+Key ---
	function handleKeyDown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === toggleKey.toLowerCase()) {
			e.preventDefault();
			toggle();
		}
	}

	function activate() {
		active = true;
		populateFromResources();
		injectStyles();
		startObserver();
		document.addEventListener("contextmenu", handleContextMenu, true);
	}

	function deactivate() {
		active = false;
		stopObserver();
		removeStyles();
		hideContextMenu();
		document.removeEventListener("contextmenu", handleContextMenu, true);
	}

	function toggle() {
		if (active) {
			deactivate();
		} else {
			activate();
		}
	}

	// --- Init ---
	document.addEventListener("keydown", handleKeyDown);
	if (startActive) {
		activate();
	}

	// --- Cleanup ---
	return () => {
		deactivate();
		document.removeEventListener("keydown", handleKeyDown);
		i18next.off("loaded", repopulateAndRescan);
		i18next.off("languageChanged", repopulateAndRescan);
		// Remove our post-processor from the active list
		const pp = (i18next.options as any)?.postProcess;
		if (Array.isArray(pp)) {
			const idx = pp.indexOf(POST_PROCESSOR_NAME);
			if (idx !== -1) pp.splice(idx, 1);
		}
		textToRef.clear();
	};
}
