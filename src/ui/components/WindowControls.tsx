import { useEffect, useState } from "react";

export function WindowControls() {
	const [isWindows, setIsWindows] = useState(false);

	useEffect(() => {
		const rpc = (window as any).rpcBridge;
		rpc?.("getPlatform", {}).then((res: { platform: string }) => {
			setIsWindows(res.platform === "win32");
		});
	}, []);

	if (!isWindows) return null;

	const rpc = (window as any).rpcBridge;

	return (
		<div className="window-controls">
			<button
				type="button"
				className="window-control-btn"
				title="Minimize"
				onClick={() => rpc("windowMinimize", {})}
			>
				&#x2014;
			</button>
			<button
				type="button"
				className="window-control-btn"
				title="Maximize"
				onClick={() => rpc("windowMaximize", {})}
			>
				&#x25A1;
			</button>
			<button
				type="button"
				className="window-control-btn window-control-close"
				title="Close"
				onClick={() => rpc("windowClose", {})}
			>
				&#x2715;
			</button>
		</div>
	);
}
