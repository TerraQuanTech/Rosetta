import type { NamespaceNode } from "@shared/types";
import { useCallback, useEffect, useRef, useState } from "react";

interface SidebarProps {
	namespaces: NamespaceNode[];
	activeNamespace: string | null;
	onSelect: (path: string) => void;
	onOpenSettings: () => void;
	onCreateNamespace: (namespace: string) => void;
	onDeleteNamespace: (namespace: string) => void;
	onAddKeyToNamespace: (namespace: string) => void;
	isSettingsActive: boolean;
	width: number;
	onWidthChange: (width: number) => void;
}

export function Sidebar({
	namespaces,
	activeNamespace,
	onSelect,
	onOpenSettings,
	onCreateNamespace,
	onDeleteNamespace,
	onAddKeyToNamespace,
	isSettingsActive,
	width,
	onWidthChange,
}: SidebarProps) {
	const [showNewNs, setShowNewNs] = useState(false);
	const [newNsName, setNewNsName] = useState("");
	const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
	const dragging = useRef(false);

	useEffect(() => {
		const onMouseMove = (e: MouseEvent) => {
			if (!dragging.current) return;
			e.preventDefault();
			const newWidth = Math.max(160, Math.min(600, e.clientX));
			onWidthChange(newWidth);
		};
		const onMouseUp = () => {
			if (dragging.current) {
				dragging.current = false;
				document.body.style.cursor = "";
				document.body.style.userSelect = "";
			}
		};
		window.addEventListener("mousemove", onMouseMove);
		window.addEventListener("mouseup", onMouseUp);
		return () => {
			window.removeEventListener("mousemove", onMouseMove);
			window.removeEventListener("mouseup", onMouseUp);
		};
	}, [onWidthChange]);

	const handleCreate = useCallback(() => {
		const name = newNsName.trim();
		if (!name) return;
		onCreateNamespace(name);
		setNewNsName("");
		setShowNewNs(false);
	}, [newNsName, onCreateNamespace]);

	const openCreateWithPrefix = useCallback((prefix: string) => {
		setNewNsName(prefix);
		setShowNewNs(true);
	}, []);

	const handleResizeStart = useCallback((e: React.MouseEvent) => {
		e.preventDefault();
		dragging.current = true;
		document.body.style.cursor = "col-resize";
		document.body.style.userSelect = "none";
	}, []);

	return (
		<div className="sidebar" style={{ width }}>
			<div className="sidebar-header electrobun-webkit-app-region-drag">
				<h1>Rosetta</h1>
			</div>
			<div className="sidebar-tree">
				{namespaces.map((node) => (
					<TreeNode
						key={node.path}
						node={node}
						activeNamespace={activeNamespace}
						onSelect={onSelect}
						onDelete={(path) => setConfirmDelete(path)}
						onAddKey={onAddKeyToNamespace}
						onCreateNamespace={openCreateWithPrefix}
						depth={0}
					/>
				))}
				{showNewNs ? (
					<div className="new-namespace-input">
						<input
							type="text"
							placeholder="e.g. pages/dashboard"
							value={newNsName}
							onChange={(e) => setNewNsName(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") handleCreate();
								if (e.key === "Escape") {
									setShowNewNs(false);
									setNewNsName("");
								}
							}}
							onBlur={() => {
								if (!newNsName.trim()) {
									setShowNewNs(false);
								}
							}}
						/>
					</div>
				) : (
					<button
						type="button"
						className="tree-item add-namespace-btn"
						onClick={() => setShowNewNs(true)}
					>
						<span style={{ width: 14, textAlign: "center", fontSize: 13 }}>+</span>
						<span>Add namespace</span>
					</button>
				)}
			</div>
			<div className="sidebar-footer">
				<button
					type="button"
					className={`sidebar-footer-btn ${isSettingsActive ? "active" : ""}`}
					onClick={onOpenSettings}
					title="Settings"
				>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
						<path
							d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6"
							fill="currentColor"
						/>
					</svg>
					Settings
				</button>
			</div>

			<div className="sidebar-resize-handle" onMouseDown={handleResizeStart} />

			{confirmDelete !== null && (
				<div
					className="dialog-overlay"
					onClick={(e) => {
						if (e.target === e.currentTarget) setConfirmDelete(null);
					}}
					onKeyDown={(e) => {
						if (e.key === "Escape") setConfirmDelete(null);
					}}
				>
					<div className="dialog">
						<h3>Delete {isDirectory(confirmDelete, namespaces) ? "directory" : "namespace"}</h3>
						<p style={{ color: "var(--text-secondary)", marginBottom: 20, lineHeight: 1.5 }}>
							Delete{" "}
							<strong>
								{confirmDelete}
								{isDirectory(confirmDelete, namespaces) ? "/" : ""}
							</strong>
							?
							{isDirectory(confirmDelete, namespaces)
								? " This will remove all namespaces under this directory from all locales."
								: " This will remove the JSON files from all locales."}
						</p>
						<div className="dialog-actions">
							<button type="button" className="toolbar-btn" onClick={() => setConfirmDelete(null)}>
								Cancel
							</button>
							<button
								type="button"
								className="toolbar-btn"
								style={{ color: "var(--missing)" }}
								onClick={() => {
									if (isDirectory(confirmDelete, namespaces)) {
										for (const leaf of collectLeaves(confirmDelete, namespaces)) {
											onDeleteNamespace(leaf);
										}
									} else {
										onDeleteNamespace(confirmDelete);
									}
									setConfirmDelete(null);
								}}
							>
								Delete
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

interface TreeNodeProps {
	node: NamespaceNode;
	activeNamespace: string | null;
	onSelect: (path: string) => void;
	onDelete: (namespace: string) => void;
	onAddKey: (namespace: string) => void;
	onCreateNamespace: (prefill: string) => void;
	depth: number;
}

function TreeNode({
	node,
	activeNamespace,
	onSelect,
	onDelete,
	onAddKey,
	onCreateNamespace,
	depth,
}: TreeNodeProps) {
	const [expanded, setExpanded] = useState(true);
	const hasChildren = node.children && node.children.length > 0;
	const isActive = activeNamespace === node.path;
	const isLeaf = !hasChildren;

	const handleClick = useCallback(() => {
		if (hasChildren) {
			setExpanded((e) => !e);
		}
		onSelect(node.path);
	}, [hasChildren, node.path, onSelect]);

	return (
		<div>
			<div className="tree-item-row">
				<button
					type="button"
					className={`tree-item ${isActive ? "active" : ""} ${hasChildren ? "folder" : ""}`}
					onClick={handleClick}
					style={{ paddingLeft: `${8 + depth * 12}px` }}
				>
					{hasChildren && (
						<svg
							className={`tree-chevron ${expanded ? "open" : ""}`}
							viewBox="0 0 16 16"
							fill="currentColor"
							aria-hidden="true"
						>
							<path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" />
						</svg>
					)}
					{!hasChildren && <span style={{ width: 14 }} />}
					<span>{node.name}</span>
				</button>
				<button
					type="button"
					className="tree-item-action add"
					onClick={(e) => {
						e.stopPropagation();
						if (isLeaf) {
							onAddKey(node.path);
						} else {
							onCreateNamespace(`${node.path}/`);
						}
					}}
					title={isLeaf ? `Add key to ${node.path}` : `Add namespace under ${node.path}/`}
				>
					+
				</button>
				<button
					type="button"
					className="tree-item-action delete"
					onClick={(e) => {
						e.stopPropagation();
						onDelete(node.path);
					}}
					title={isLeaf ? `Delete ${node.path}` : `Delete ${node.path}/ and all children`}
				>
					&times;
				</button>
			</div>
			{hasChildren && expanded && (
				<div className="tree-children">
					{node.children!.map((child) => (
						<TreeNode
							key={child.path}
							node={child}
							activeNamespace={activeNamespace}
							onSelect={onSelect}
							onDelete={onDelete}
							onAddKey={onAddKey}
							onCreateNamespace={onCreateNamespace}
							depth={depth + 1}
						/>
					))}
				</div>
			)}
		</div>
	);
}

/** Check if a path is a directory (has children) in the namespace tree */
function isDirectory(path: string, nodes: NamespaceNode[]): boolean {
	for (const node of nodes) {
		if (node.path === path) return !!(node.children && node.children.length > 0);
		if (node.children && isDirectory(path, node.children)) return true;
	}
	return false;
}

/** Collect all leaf namespace paths under a directory */
function collectLeaves(dirPath: string, nodes: NamespaceNode[]): string[] {
	for (const node of nodes) {
		if (node.path === dirPath) {
			if (!node.children) return [node.path];
			return node.children.flatMap((c) => collectLeaves(c.path, [c]));
		}
		if (node.children) {
			const found = collectLeaves(dirPath, node.children);
			if (found.length) return found;
		}
	}
	return [];
}
