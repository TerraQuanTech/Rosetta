/**
 * HACK: Works around a compositor positioning bug on Windows.
 *
 * With `titleBarStyle: "default"`, the native title bar creates a mismatch
 * between the window frame and the webview content area. On resize the
 * compositor places content at the wrong vertical offset.
 *
 * The fix: toggle `document.body.opacity` to force the compositor to
 * re-paint at the correct position. On macOS this is avoided entirely by
 * using `titleBarStyle: "hiddenInset"` which eliminates the frame mismatch.
 *
 * Called from two places:
 * - main.tsx `forceRelayout` RPC handler (on each window resize, sent from bun side)
 * - bun side triggers an initial resize jitter on startup to settle the compositor
 */
export function forceRelayout() {
	document.body.style.opacity = "0.999";
	requestAnimationFrame(() => {
		document.body.style.opacity = "1";
	});
}
