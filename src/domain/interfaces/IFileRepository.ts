import { FsNodeEntity, FileNode, DirectoryNode } from '../entities/FsNode';

export interface IFileRepository {
  createFile(file: FileNode): Promise<void>;
  createDirectory(directory: DirectoryNode): Promise<void>;
  findByPath(path: string, ownerId: string): Promise<FsNodeEntity | null>;
  findByOwnerAndPathPrefix(ownerId: string, pathPrefix: string): Promise<FsNodeEntity[]>;
  updateFile(file: FileNode): Promise<void>;
  updateDirectory(directory: DirectoryNode): Promise<void>;
  deleteByPath(path: string, ownerId: string): Promise<void>;
  deleteByPathPrefix(pathPrefix: string, ownerId: string): Promise<void>;
  findChildren(path: string, ownerId: string): Promise<FsNodeEntity[]>;
  exists(path: string, ownerId: string): Promise<boolean>;
  beginTransaction(): Promise<void>;
  commitTransaction(): Promise<void>;
  rollbackTransaction(): Promise<void>;
}

