import { FsNode } from '../entities/FsNode';

export interface FsProvider {
  createDirectory(path: string): Promise<void>;
  deleteDirectory(path: string): Promise<void>;
  copyDirectory(path: string, newPath: string): Promise<void>;
  moveDirectory(path: string, newPath: string): Promise<void>;
  listDirectory(path: string): Promise<FsNode[]>;
  writeFile(path: string, content: string | Buffer): Promise<void>;
  readFile(path: string): Promise<string | Buffer>;
  deleteFile(path: string): Promise<void>;
  copyFile(path: string, newPath: string): Promise<void>;
  moveFile(path: string, newPath: string): Promise<void>;
  getInfo(path: string): Promise<FsNode>;
  setWorkingDirectory(path: string): Promise<void>;
  getWorkingDirectory(): Promise<string>;
}

