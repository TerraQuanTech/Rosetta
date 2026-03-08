import { useCallback, useState } from "react";
import type { NamespaceNode } from "../../shared/types";

interface SidebarProps {
	namespaces: NamespaceNode[];
	activeNamespace: string | null;
	onSelect: (path: string) => void;
	onOpenSettings: () => void;
	onCreateNamespace: (namespace: string) => void;
	onDeleteNamespace: (namespace: string) => void;
	onAddKeyToNamespace: (namespace: string) => void;
	isSettingsActive: boolean;
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
}: SidebarProps) {
	const [showNewNs, setShowNewNs] = useState(false);
	const [newNsName, setNewNsName] = useState("");
	const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

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

	return (
		<div className="sidebar">
			<div className="sidebar-header">
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
					<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
						<path
							d="M6.5 1.75a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 .75.75v.3c0 .285.183.538.45.633a4.5 4.5 0 0 1 .826.39c.242.148.54.154.76-.02l.213-.17a.75.75 0 0 1 1.06.06l1.06 1.06a.75.75 0 0 1 .06 1.06l-.17.213c-.174.22-.168.518-.02.76.156.265.29.54.39.826.095.267.348.45.633.45h.3a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-.75.75h-.3c-.285 0-.538.183-.633.45a4.5 4.5 0 0 1-.39.826c-.148.242-.154.54.02.76l.17.213a.75.75 0 0 1-.06 1.06l-1.06 1.06a.75.75 0 0 1-1.06.06l-.213-.17c-.22-.174-.518-.168-.76-.02a4.5 4.5 0 0 1-.826.39c-.267.095-.45.348-.45.633v.3a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1-.75-.75v-.3c0-.285-.183-.538-.45-.633a4.5 4.5 0 0 1-.826-.39c-.242-.148-.54-.154-.76.02l-.213.17a.75.75 0 0 1-1.06-.06l-1.06-1.06a.75.75 0 0 1-.06-1.06l.17-.213c.174-.22.168-.518.02-.76a4.5 4.5 0 0 1-.39-.826c-.095-.267-.348-.45-.633-.45h-.3a.75.75 0 0 1-.75-.75v-1.5a.75.75 0 0 1 .75-.75h.3c.285 0 .538-.183.633-.45a4.5 4.5 0 0 1 .39-.826c.148-.242.154-.54-.02-.76l-.17-.213a.75.75 0 0 1 .06-1.06l1.06-1.06a.75.75 0 0 1 1.06-.06l.213.17c.22.174.518.168.76.02.265-.156.54-.29.826-.39.267-.095.45-.348.45-.633v-.3ZM8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
							fill="currentColor"
						/>
					</svg>
				</button>
			</div>

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
