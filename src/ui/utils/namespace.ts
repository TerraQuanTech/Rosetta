import type { NamespaceNode } from "@shared/types";

export function findFirstLeaf(nodes: NamespaceNode[]): string | null {
	for (const node of nodes) {
		if (!node.children || node.children.length === 0) {
			return node.path;
		}
		const leaf = findFirstLeaf(node.children);
		if (leaf) return leaf;
	}
	return null;
}
