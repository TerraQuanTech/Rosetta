import { type ConnectionStatus, RosettaConnector } from "./connector";
import { applyTranslation, getSelectedShapeInfo, readAllSlides } from "./office";
import { loadTranslations, saveLocales, saveUpdate } from "./storage";
import type { IncomingMessage, PptxSlideData } from "./types";
import "./style.css";

let connector: RosettaConnector;
let slides: PptxSlideData[] = [];
let autoApply = true;
let pendingUpdates: IncomingMessage[] = [];
let currentSourceLocale = "en";
let syncing = false;
let hasInitialSync = false;

const elements = {
	status: () => document.getElementById("status")!,
	statusText: () => document.getElementById("status-text")!,
	portInput: () => document.getElementById("port-input") as HTMLInputElement,
	connectBtn: () => document.getElementById("connect-btn")!,
	localeSelect: () => document.getElementById("locale-select") as HTMLSelectElement,
	autoApplyCheckbox: () => document.getElementById("auto-apply") as HTMLInputElement,
	syncBtn: () => document.getElementById("sync-btn")!,
	applyAllBtn: () => document.getElementById("apply-all-btn")!,
	slideInfo: () => document.getElementById("slide-info")!,
	slideCount: () => document.getElementById("slide-count")!,
	shapeCount: () => document.getElementById("shape-count")!,
};

function getSelectedLocale(): string {
	return elements.localeSelect().value || currentSourceLocale;
}

function updateStatusUI(status: ConnectionStatus): void {
	const el = elements.status();
	const textEl = elements.statusText();
	el.className = `status ${status}`;
	const labels: Record<ConnectionStatus, string> = {
		connecting: "Connecting...",
		connected: "Connected",
		disconnected: "Disconnected",
	};
	textEl.textContent = labels[status];

	const connectBtn = elements.connectBtn();
	connectBtn.textContent = status === "connected" ? "Disconnect" : "Connect";

	const syncBtn = elements.syncBtn();
	const applyAllBtn = elements.applyAllBtn();
	syncBtn.toggleAttribute("disabled", status !== "connected");
	applyAllBtn.toggleAttribute("disabled", status !== "connected");
}

function updateLocaleDropdown(locales: string[], sourceLocale: string): void {
	const select = elements.localeSelect();
	const currentValue = select.value;
	select.innerHTML = "";
	select.disabled = false;

	for (const locale of locales) {
		const opt = document.createElement("option");
		opt.value = locale;
		opt.textContent = locale === sourceLocale ? `${locale} (source)` : locale;
		select.appendChild(opt);
	}

	if (currentValue && locales.includes(currentValue)) {
		select.value = currentValue;
	} else if (locales.length > 0) {
		select.value = locales[0];
	}
}

function handleMessage(msg: IncomingMessage): void {
	if (msg.type === "pptx:locales") {
		currentSourceLocale = msg.sourceLocale;
		updateLocaleDropdown(msg.locales, msg.sourceLocale);
		saveLocales(msg.locales, msg.sourceLocale).catch(() => {});
		return;
	}

	if (autoApply) {
		applyMessage(msg);
	} else {
		pendingUpdates.push(msg);
		updateApplyAllLabel();
	}
}

async function applyMessage(msg: IncomingMessage): Promise<void> {
	if (msg.type !== "translation:update") return;

	saveUpdate(msg.namespace, msg.key, msg.locale, msg.value).catch(() => {});

	if (msg.locale === getSelectedLocale()) {
		await applyTranslation(msg.namespace, msg.key, msg.value);
	}
}

function updateApplyAllLabel(): void {
	const btn = elements.applyAllBtn();
	if (pendingUpdates.length > 0) {
		btn.textContent = `Apply All (${pendingUpdates.length} pending)`;
	} else {
		btn.textContent = "Apply All Translations";
	}
}

// Full sync: reads all slide text (must be called when slides show SOURCE locale text)
// and sends to Rosetta. This is the initial capture of source content.
async function syncSlides(): Promise<void> {
	const syncBtn = elements.syncBtn();
	syncBtn.textContent = "Syncing...";
	syncBtn.toggleAttribute("disabled", true);
	syncing = true;

	try {
		// If we've already synced and preview is not source, restore source text first
		const previewLocale = getSelectedLocale();
		const needsRestore = hasInitialSync && previewLocale !== currentSourceLocale;

		if (needsRestore) {
			await applyLocaleToSlides(currentSourceLocale);
		}

		slides = await readAllSlides();

		if (needsRestore) {
			await applyLocaleToSlides(previewLocale);
		}

		const saved = await loadTranslations();
		if (saved.meta) {
			currentSourceLocale = saved.meta.sourceLocale;
		}

		let totalShapes = 0;
		for (const slide of slides) {
			totalShapes += slide.shapes.length;
		}

		elements.slideInfo().hidden = false;
		elements.slideCount().textContent = String(slides.length);
		elements.shapeCount().textContent = String(totalShapes);

		connector.send({
			type: "pptx:sync",
			sourceLocale: currentSourceLocale,
			slides,
			savedTranslations:
				Object.keys(saved.translations).length > 0 ? saved.translations : undefined,
			savedLocales: saved.meta?.locales,
		});

		hasInitialSync = true;
		lastFingerprint = getFullFingerprint(slides);
	} catch (err) {
		console.error("[rosetta-addin] Failed to sync slides:", err);
	} finally {
		syncing = false;
		syncBtn.textContent = "Sync Slides to Rosetta";
		syncBtn.toggleAttribute("disabled", !connector.isConnected);
	}
}

// Apply a specific locale's text to all slides
async function applyLocaleToSlides(locale: string): Promise<void> {
	const saved = await loadTranslations();

	for (const slide of slides) {
		const ns = slide.name;
		for (const shape of slide.shapes) {
			for (let pi = 0; pi < shape.paragraphs.length; pi++) {
				const key = `${shape.name}.p${pi}`;
				const text = saved.translations[ns]?.[key]?.[locale];
				if (text !== undefined) {
					await applyTranslation(ns, key, text);
				} else if (locale === currentSourceLocale) {
					await applyTranslation(ns, key, shape.paragraphs[pi].text);
				}
			}
		}
	}
}

async function switchPreviewLocale(): Promise<void> {
	await applyLocaleToSlides(getSelectedLocale());
}

async function applyAllPending(): Promise<void> {
	const updates = [...pendingUpdates];
	pendingUpdates = [];
	updateApplyAllLabel();

	for (const msg of updates) {
		await applyMessage(msg);
	}
}

function getFullFingerprint(data: PptxSlideData[]): string {
	return JSON.stringify(
		data.map((s) => s.shapes.map((sh) => ({
			n: sh.name,
			p: sh.paragraphs.map((p) => p.text),
		}))),
	);
}

let lastFingerprint = "";

async function autoSyncCheck(): Promise<void> {
	if (!connector.isConnected || syncing || !hasInitialSync) return;
	// Only auto-sync when previewing source locale — otherwise the slide
	// text is our translated output and reading it would corrupt the source.
	if (getSelectedLocale() !== currentSourceLocale) return;

	try {
		const fresh = await readAllSlides();
		const fingerprint = getFullFingerprint(fresh);

		if (fingerprint !== lastFingerprint) {
			slides = fresh;
			lastFingerprint = fingerprint;

			const saved = await loadTranslations();

			let totalShapes = 0;
			for (const slide of slides) {
				totalShapes += slide.shapes.length;
			}

			elements.slideInfo().hidden = false;
			elements.slideCount().textContent = String(slides.length);
			elements.shapeCount().textContent = String(totalShapes);

			connector.send({
				type: "pptx:sync",
				sourceLocale: currentSourceLocale,
				slides,
				savedTranslations:
					Object.keys(saved.translations).length > 0 ? saved.translations : undefined,
				savedLocales: saved.meta?.locales,
			});
		}
	} catch {}
}

function setupSelectionHandler(): void {
	try {
		Office.context.document.addHandlerAsync(Office.EventType.DocumentSelectionChanged, async () => {
			if (!connector.isConnected) return;
			const info = await getSelectedShapeInfo();
			if (info) {
				connector.send({
					type: "key:focus",
					namespace: info.namespace,
					key: info.key,
				});
			}
		});
	} catch {}
}

Office.onReady(({ host }) => {
	if (host !== Office.HostType.PowerPoint) return;

	connector = new RosettaConnector({
		port: Number.parseInt(elements.portInput().value, 10) || 4871,
		onMessage: handleMessage,
		onStatusChange: updateStatusUI,
	});

	elements.connectBtn().addEventListener("click", () => {
		if (connector.isConnected) {
			connector.disconnect();
		} else {
			const port = Number.parseInt(elements.portInput().value, 10) || 4871;
			connector.updatePort(port);
			connector.connect();
		}
	});

	elements.syncBtn().addEventListener("click", syncSlides);
	elements.applyAllBtn().addEventListener("click", applyAllPending);
	elements.localeSelect().addEventListener("change", switchPreviewLocale);

	elements.autoApplyCheckbox().addEventListener("change", (e) => {
		autoApply = (e.target as HTMLInputElement).checked;
		if (autoApply && pendingUpdates.length > 0) {
			applyAllPending();
		}
	});

	setupSelectionHandler();
	connector.connect();

	setInterval(autoSyncCheck, 5000);
});
