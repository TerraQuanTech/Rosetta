export interface DirEntry {
	name: string;
	isDirectory: boolean;
	isFile: boolean;
}

export interface FileSystemAdapter {
	readFile(path: string): Promise<string>;
	writeFile(path: string, content: string): Promise<void>;
	readDir(path: string): Promise<DirEntry[]>;
	/** Create directory (recursive) */
	mkdir(path: string): Promise<void>;
	rm(path: string, opts?: { recursive?: boolean }): Promise<void>;
	exists(path: string): Promise<boolean>;
}
