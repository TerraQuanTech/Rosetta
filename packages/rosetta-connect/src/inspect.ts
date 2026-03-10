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

	// --- 1. Monkey-patch i18next.t() ---
	const originalT = i18next.t.bind(i18next);

	const patchedT = (...args: unknown[]) => {
		const result = (originalT as unknown as (...a: unknown[]) => string)(...args);

		if (typeof result === "string" && result.length > 0) {
			const firstArg = args[0];
			let ns: string | undefined;
			let key: string;

			if (typeof firstArg === "string") {
				// t("ns:key") or t("key")
				if (firstArg.includes(":")) {
					const idx = firstArg.indexOf(":");
					ns = firstArg.slice(0, idx);
					key = firstArg.slice(idx + 1);
				} else {
					key = firstArg;
				}
			} else {
				return result;
			}

			// Resolve namespace from options or i18next defaults
			if (!ns) {
				const opts = args[1];
				if (typeof opts === "object" && opts !== null && "ns" in opts) {
					ns = String((opts as { ns: string }).ns);
				} else {
					const defaultNs = i18next.options?.defaultNS;
					ns = String((Array.isArray(defaultNs) ? defaultNs[0] : defaultNs) || "translation");
				}
			}

			textToRef.set(result, { namespace: ns!, key });
		}

		return result;
	};

	(i18next as any).t = patchedT;

	// --- 2. CSS injection ---
	function injectStyles() {
		if (document.getElementById(STYLE_ID)) return;
		const style = document.createElement("style");
		style.id = STYLE_ID;
		style.textContent = `
			${WRAPPER_TAG} {
				outline: 1.5px dashed rgba(123, 108, 240, 0.5);
				outline-offset: 1px;
				border-radius: 2px;
				cursor: pointer;
				transition: outline-color 0.15s, background-color 0.15s;
			}
			${WRAPPER_TAG}:hover {
				outline-color: rgba(123, 108, 240, 0.9);
				background-color: rgba(123, 108, 240, 0.08);
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

		const ref = textToRef.get(text);
		if (!ref) return;

		// Already wrapped
		const parent = textNode.parentElement;
		if (parent?.tagName === WRAPPER_TAG.toUpperCase()) return;

		const wrapper = document.createElement(WRAPPER_TAG);
		wrapper.setAttribute(ATTR_NS, ref.namespace);
		wrapper.setAttribute(ATTR_KEY, ref.key);
		textNode.parentNode?.insertBefore(wrapper, textNode);
		wrapper.appendChild(textNode);
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
		(i18next as any).t = originalT;
		textToRef.clear();
	};
}
