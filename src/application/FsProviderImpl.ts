import { FsProvider } from "../domain/interfaces/FsProvider";
import { IFileRepository } from "../domain/interfaces/IFileRepository";
import { IBlobRepository } from "../domain/interfaces/IBlobRepository";
import { IBlobStorage } from "../domain/interfaces/IBlobStorage";
import {
  FsNode,
  FileNode,
  DirectoryNode,
  NodeType,
} from "../domain/entities/FsNode";
import { PathUtils } from "../domain/utils/PathUtils";
import { HashUtils } from "../domain/utils/HashUtils";
import * as mime from "mime-types";
import * as uuid from "uuid";

export class FsProviderImpl implements FsProvider {
  private workingDirectory: string = "/";
  private ownerId: string;

  constructor(
    private fileRepository: IFileRepository,
    private blobRepository: IBlobRepository,
    private blobStorage: IBlobStorage,
    ownerId: string
  ) {
    this.ownerId = ownerId;
  }

  async createDirectory(path: string): Promise<void> {
    const fullPath = PathUtils.resolve(this.workingDirectory, path);
    const normalizedPath = PathUtils.normalize(fullPath);

    if (normalizedPath === "/") {
      const exists = await this.fileRepository.exists(
        normalizedPath,
        this.ownerId
      );
      if (exists) {
        throw new Error(`exists: ${normalizedPath}`);
      }
      const directory: DirectoryNode = {
        name: "/",
        path: "/",
        size: 0,
        mimeType: "inode/directory",
        createDate: new Date(),
        updateDate: new Date(),
        ownerId: this.ownerId,
        type: NodeType.DIRECTORY,
      };
      await this.fileRepository.createDirectory(directory);
      return;
    }

    if (await this.fileRepository.exists(normalizedPath, this.ownerId)) {
      throw new Error(`Directory already exists: ${normalizedPath}`);
    }
    await this.ensureParentDirectories(normalizedPath);
    const directory: DirectoryNode = {
      name: PathUtils.basename(normalizedPath),
      path: normalizedPath,
      size: 0,
      mimeType: "inode/directory",
      createDate: new Date(),
      updateDate: new Date(),
      ownerId: this.ownerId,
      type: NodeType.DIRECTORY,
    };

    await this.fileRepository.createDirectory(directory);
  }

  async deleteDirectory(path: string): Promise<void> {
    const fullPath = PathUtils.resolve(this.workingDirectory, path);
    const normalizedPath = PathUtils.normalize(fullPath);

    const node = await this.fileRepository.findByPath(
      normalizedPath,
      this.ownerId
    );
    if (!node || node.type !== NodeType.DIRECTORY) {
      throw new Error(`Directory not found: ${normalizedPath}`);
    }

    const children = await this.fileRepository.findByOwnerAndPathPrefix(
      this.ownerId,
      normalizedPath === "/" ? "/" : `${normalizedPath}/`
    );

    await this.fileRepository.beginTransaction();
    try {
      const blobIds: string[] = [];
      for (const child of children) {
        if (child.type === NodeType.FILE) {
          blobIds.push(child.blobId);
        }
      }

      await this.fileRepository.deleteByPathPrefix(
        normalizedPath,
        this.ownerId
      );

      for (const blobId of blobIds) {
        const refCount = await this.blobRepository.decrementReference(blobId);
        if (refCount <= 0) {
          await this.blobStorage.delete(blobId);
          await this.blobRepository.deleteBlob(blobId);
        }
      }

      await this.fileRepository.commitTransaction();
    } catch (error) {
      await this.fileRepository.rollbackTransaction();
      throw error;
    }
  }

  async copyDirectory(path: string, newPath: string): Promise<void> {
    const fullPath = PathUtils.resolve(this.workingDirectory, path);
    const normalizedPath = PathUtils.normalize(fullPath);
    const fullNewPath = PathUtils.resolve(this.workingDirectory, newPath);
    const normalizedNewPath = PathUtils.normalize(fullNewPath);

    if (PathUtils.isAncestor(normalizedPath, normalizedNewPath)) {
      throw new Error("Cannot copy directory into itself");
    }

    const sourceNode = await this.fileRepository.findByPath(
      normalizedPath,
      this.ownerId
    );
    if (!sourceNode || sourceNode.type !== NodeType.DIRECTORY) {
      throw new Error(`Source directory not found: ${normalizedPath}`);
    }

    const children = await this.fileRepository.findByOwnerAndPathPrefix(
      this.ownerId,
      normalizedPath === "/" ? "/" : `${normalizedPath}/`
    );

    await this.fileRepository.beginTransaction();
    try {
      await this.createDirectory(normalizedNewPath);
      for (const child of children) {
        const relativePath = child.path.substring(normalizedPath.length);
        const newChildPath = PathUtils.join(normalizedNewPath, relativePath);

        if (child.type === NodeType.FILE) {
          const content = await this.readFile(child.path);
          await this.writeFile(newChildPath, content);
        } else {
          await this.createDirectory(newChildPath);
        }
      }

      await this.fileRepository.commitTransaction();
    } catch (error) {
      await this.fileRepository.rollbackTransaction();
      throw error;
    }
  }

  async moveDirectory(path: string, newPath: string): Promise<void> {
    const fullPath = PathUtils.resolve(this.workingDirectory, path);
    const normalizedPath = PathUtils.normalize(fullPath);
    const fullNewPath = PathUtils.resolve(this.workingDirectory, newPath);
    const normalizedNewPath = PathUtils.normalize(fullNewPath);

    if (PathUtils.isAncestor(normalizedPath, normalizedNewPath)) {
      throw new Error("Cannot move directory into itself");
    }

    const sourceNode = await this.fileRepository.findByPath(
      normalizedPath,
      this.ownerId
    );
    if (!sourceNode || sourceNode.type !== NodeType.DIRECTORY) {
      throw new Error(`Source directory not found: ${normalizedPath}`);
    }

    const children = await this.fileRepository.findByOwnerAndPathPrefix(
      this.ownerId,
      normalizedPath === "/" ? "/" : `${normalizedPath}/`
    );

    await this.fileRepository.beginTransaction();
    try {
      await this.createDirectory(normalizedNewPath);

      for (const child of children) {
        const relativePath = child.path.substring(normalizedPath.length);
        const newChildPath = PathUtils.join(normalizedNewPath, relativePath);

        if (child.type === NodeType.FILE) {
          await this.moveFile(child.path, newChildPath);
        } else {
          await this.moveDirectory(child.path, newChildPath);
        }
      }

      await this.fileRepository.deleteByPath(normalizedPath, this.ownerId);

      await this.fileRepository.commitTransaction();
    } catch (error) {
      await this.fileRepository.rollbackTransaction();
      throw error;
    }
  }

  async listDirectory(path: string): Promise<FsNode[]> {
    const fullPath = PathUtils.resolve(this.workingDirectory, path);
    const normalizedPath = PathUtils.normalize(fullPath);

    let node = await this.fileRepository.findByPath(
      normalizedPath,
      this.ownerId
    );

    if (!node && normalizedPath === "/") {
      await this.createDirectory("/");
      node = await this.fileRepository.findByPath(normalizedPath, this.ownerId);
    }

    if (!node) {
      throw new Error(`Directory not found: ${normalizedPath}`);
    }

    if (node.type !== NodeType.DIRECTORY) {
      throw new Error(`Path is not a directory: ${normalizedPath}`);
    }

    const children = await this.fileRepository.findChildren(
      normalizedPath,
      this.ownerId
    );
    return children.map((child) => ({
      name: child.name,
      path: child.path,
      size: child.size,
      mimeType: child.mimeType,
      createDate: child.createDate,
      updateDate: child.updateDate,
      ownerId: child.ownerId,
    }));
  }

  async writeFile(path: string, content: string | Buffer): Promise<void> {
    const fullPath = PathUtils.resolve(this.workingDirectory, path);
    const normalizedPath = PathUtils.normalize(fullPath);

    let buffer: Buffer;
    if (Buffer.isBuffer(content)) {
      buffer = content;
    } else {
      buffer = Buffer.from(content, "utf-8");
    }
    const hash = await HashUtils.computeHash(buffer);
    const size = buffer.length;
    const mimeType = mime.lookup(normalizedPath) || "application/octet-stream";

    const existingBlob = await this.findBlobByHash(hash);
    let blobId: string;

    if (existingBlob) {
      blobId = existingBlob.blobId;
      await this.blobRepository.incrementReference(blobId);
    } else {
      blobId = uuid.v4();
      await this.blobStorage.store(blobId, buffer);
      await this.blobRepository.createBlob(blobId, hash, size);
    }

    await this.ensureParentDirectories(normalizedPath);

    const existingNode = await this.fileRepository.findByPath(
      normalizedPath,
      this.ownerId
    );
    const now = new Date();

    if (existingNode && existingNode.type === NodeType.FILE) {
      const oldBlobId = existingNode.blobId;
      const fileName = normalizedPath.split("/").pop() || normalizedPath;
      const file: FileNode = {
        name: fileName,
        path: normalizedPath,
        size,
        mimeType,
        createDate: existingNode.createDate,
        updateDate: now,
        ownerId: this.ownerId,
        type: NodeType.FILE,
        blobId,
      };

      await this.fileRepository.updateFile(file);

      if (oldBlobId !== blobId) {
        const refCount = await this.blobRepository.decrementReference(
          oldBlobId
        );
        if (refCount <= 0) {
          await this.blobStorage.delete(oldBlobId);
          await this.blobRepository.deleteBlob(oldBlobId);
        }
      }
    } else {
      const parts = normalizedPath.split("/");
      const fileName = parts[parts.length - 1] || normalizedPath;
      const file: FileNode = {
        name: fileName,
        path: normalizedPath,
        size,
        mimeType,
        createDate: now,
        updateDate: now,
        ownerId: this.ownerId,
        type: NodeType.FILE,
        blobId,
      };

      await this.fileRepository.createFile(file);
    }
  }

  async readFile(path: string): Promise<string | Buffer> {
    const fullPath = PathUtils.resolve(this.workingDirectory, path);
    const normalizedPath = PathUtils.normalize(fullPath);

    const node = await this.fileRepository.findByPath(
      normalizedPath,
      this.ownerId
    );
    if (!node || node.type !== NodeType.FILE) {
      throw new Error(`File not found: ${normalizedPath}`);
    }

    const buffer = await this.blobStorage.retrieve(node.blobId);

    if (
      node.mimeType.includes("text") ||
      node.mimeType === "application/json" ||
      node.mimeType === "application/javascript"
    ) {
      return buffer.toString("utf-8");
    }
    return buffer;
  }

  async deleteFile(path: string): Promise<void> {
    const fullPath = PathUtils.resolve(this.workingDirectory, path);
    const normalizedPath = PathUtils.normalize(fullPath);

    const node = await this.fileRepository.findByPath(
      normalizedPath,
      this.ownerId
    );
    if (!node || node.type !== NodeType.FILE) {
      throw new Error(`File not found: ${normalizedPath}`);
    }

    await this.fileRepository.deleteByPath(normalizedPath, this.ownerId);

    const refCount = await this.blobRepository.decrementReference(node.blobId);
    if (refCount <= 0) {
      await this.blobStorage.delete(node.blobId);
      await this.blobRepository.deleteBlob(node.blobId);
    }
  }

  async copyFile(path: string, newPath: string): Promise<void> {
    const fullPath = PathUtils.resolve(this.workingDirectory, path);
    const normalizedPath = PathUtils.normalize(fullPath);
    const fullNewPath = PathUtils.resolve(this.workingDirectory, newPath);
    const normalizedNewPath = PathUtils.normalize(fullNewPath);

    const sourceNode = await this.fileRepository.findByPath(
      normalizedPath,
      this.ownerId
    );
    if (!sourceNode) {
      throw new Error(`Source file not found: ${normalizedPath}`);
    }
    if (sourceNode.type !== NodeType.FILE) {
      throw new Error(`Source file not found: ${normalizedPath}`);
    }

    const content = await this.readFile(normalizedPath);
    await this.writeFile(normalizedNewPath, content);
  }

  async moveFile(path: string, newPath: string): Promise<void> {
    const fullPath = PathUtils.resolve(this.workingDirectory, path);
    const normalizedPath = PathUtils.normalize(fullPath);
    const fullNewPath = PathUtils.resolve(this.workingDirectory, newPath);
    const normalizedNewPath = PathUtils.normalize(fullNewPath);

    const sourceNode = await this.fileRepository.findByPath(
      normalizedPath,
      this.ownerId
    );
    if (!sourceNode) {
      throw new Error(`Source file not found: ${normalizedPath}`);
    }
    if (sourceNode.type !== NodeType.FILE) {
      throw new Error(`Source file not found: ${normalizedPath}`);
    }

    await this.fileRepository.beginTransaction();
    try {
      const fileNameParts = normalizedNewPath.split("/");
      const newFileName = fileNameParts[fileNameParts.length - 1] || normalizedNewPath;
      const updatedFile: FileNode = {
        ...sourceNode,
        name: newFileName,
        path: normalizedNewPath,
        updateDate: new Date(),
      };

      await this.fileRepository.deleteByPath(normalizedPath, this.ownerId);
      await this.fileRepository.createFile(updatedFile);

      await this.fileRepository.commitTransaction();
    } catch (error) {
      await this.fileRepository.rollbackTransaction();
      throw error;
    }
  }

  async getInfo(path: string): Promise<FsNode> {
    const fullPath = PathUtils.resolve(this.workingDirectory, path);
    const normalizedPath = PathUtils.normalize(fullPath);

    const node = await this.fileRepository.findByPath(
      normalizedPath,
      this.ownerId
    );
    if (!node) {
      throw new Error(`Node not found: ${normalizedPath}`);
    }

    return {
      name: node.name,
      path: node.path,
      size: node.size,
      mimeType: node.mimeType,
      createDate: node.createDate,
      updateDate: node.updateDate,
      ownerId: node.ownerId,
    };
  }

  async setWorkingDirectory(path: string): Promise<void> {
    const fullPath = PathUtils.resolve(this.workingDirectory, path);
    const normalizedPath = PathUtils.normalize(fullPath);

    const node = await this.fileRepository.findByPath(
      normalizedPath,
      this.ownerId
    );
    if (!node || node.type !== NodeType.DIRECTORY) {
      throw new Error(`Directory not found: ${normalizedPath}`);
    }

    this.workingDirectory = normalizedPath;
  }

  async getWorkingDirectory(): Promise<string> {
    return this.workingDirectory;
  }

  async cleanupOrphanBlobs(): Promise<void> {
    const orphanBlobs = await this.blobRepository.findOrphanBlobs();
    for (const blobId of orphanBlobs) {
      try {
        await this.blobStorage.delete(blobId);
        await this.blobRepository.deleteBlob(blobId);
      } catch (error) {
        console.log(error)
      }
    }
  }

  private async ensureParentDirectories(path: string): Promise<void> {
    const parentPath = PathUtils.dirname(path);

    const rootExists = await this.fileRepository.exists("/", this.ownerId);
    if (!rootExists) {
      const rootDirectory: DirectoryNode = {
        name: "/",
        path: "/",
        size: 0,
        mimeType: "inode/directory",
        createDate: new Date(),
        updateDate: new Date(),
        ownerId: this.ownerId,
        type: NodeType.DIRECTORY,
      };
      await this.fileRepository.createDirectory(rootDirectory);
    }

    if (parentPath === "/" || parentPath === path) {
      return;
    }

    const exists = await this.fileRepository.exists(parentPath, this.ownerId);
    if (!exists) {
      await this.createDirectory(parentPath);
    }
  }

  private async findBlobByHash(hash: string ): Promise<{ blobId: string } | null> {
    const blobRef = await this.blobRepository.findByHash(hash);
    if (blobRef) {
      return { blobId: blobRef.blobId };
    }
    return null;
  }
}
