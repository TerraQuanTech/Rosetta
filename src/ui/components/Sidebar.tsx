import { useCallback, useState } from "react";
import type { NamespaceNode } from "../../shared/types";

interface SidebarProps {
	namespaces: NamespaceNode[];
	activeNamespace: string | null;
	onSelect: (path: string) => void;
	onOpenSettings: () => void;
	isSettingsActive: boolean;
}

export function Sidebar({
	namespaces,
	activeNamespace,
	onSelect,
	onOpenSettings,
	isSettingsActive,
}: SidebarProps) {
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
						depth={0}
					/>
				))}
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
		</div>
	);
}

interface TreeNodeProps {
	node: NamespaceNode;
	activeNamespace: string | null;
	onSelect: (path: string) => void;
	depth: number;
}

function TreeNode({ node, activeNamespace, onSelect, depth }: TreeNodeProps) {
	const [expanded, setExpanded] = useState(true);
	const hasChildren = node.children && node.children.length > 0;
	const isFolder = hasChildren && !node.path.includes(".");
	const isActive = activeNamespace === node.path;

	const handleClick = useCallback(() => {
		if (hasChildren) {
			setExpanded((e) => !e);
		}
		onSelect(node.path);
	}, [hasChildren, node.path, onSelect]);

	return (
		<div>
			<button
				type="button"
				className={`tree-item ${isActive ? "active" : ""} ${isFolder ? "folder" : ""}`}
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
			{hasChildren && expanded && (
				<div className="tree-children">
					{node.children!.map((child) => (
						<TreeNode
							key={child.path}
							node={child}
							activeNamespace={activeNamespace}
							onSelect={onSelect}
							depth={depth + 1}
						/>
					))}
				</div>
			)}
		</div>
	);
}
