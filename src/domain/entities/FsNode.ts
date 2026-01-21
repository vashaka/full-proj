export interface FsNode {
  name: string;
  path: string;
  size: number;
  mimeType: string;
  createDate: Date;
  updateDate: Date;
  ownerId: string;
}

export enum NodeType {
  FILE = "file",
  DIRECTORY = "directory",
}

export interface FileNode extends FsNode {
  type: NodeType.FILE;
  blobId: string;
}

export interface DirectoryNode extends FsNode {
  type: NodeType.DIRECTORY;
}

export type FsNodeEntity = FileNode | DirectoryNode;
