import { access, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import type { DirEntry, FileSystemAdapter } from "./fs-adapter";

export class NodeFsAdapter implements FileSystemAdapter {
	async readFile(path: string): Promise<string> {
		return readFile(path, "utf-8");
	}

	async writeFile(path: string, content: string): Promise<void> {
		await writeFile(path, content, "utf-8");
	}

	async readDir(path: string): Promise<DirEntry[]> {
		const entries = await readdir(path, { withFileTypes: true });
		return entries.map((e) => ({
			name: e.name,
			isDirectory: e.isDirectory(),
			isFile: e.isFile(),
		}));
	}

	async mkdir(path: string): Promise<void> {
		await mkdir(path, { recursive: true });
	}

	async rm(path: string, opts?: { recursive?: boolean }): Promise<void> {
		await rm(path, { recursive: opts?.recursive ?? false });
	}

	async exists(path: string): Promise<boolean> {
		try {
			await access(path);
			return true;
		} catch {
			return false;
		}
	}
}
