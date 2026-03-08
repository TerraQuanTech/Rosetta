import { useCallback, useState } from "react";
import type { NamespaceNode } from "../../shared/types";

interface SidebarProps {
	namespaces: NamespaceNode[];
	activeNamespace: string | null;
	onSelect: (path: string) => void;
}

export function Sidebar({ namespaces, activeNamespace, onSelect }: SidebarProps) {
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
		// Always select — folders might also be file-backed namespaces
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
