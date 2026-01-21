import { Database } from "sqlite3";
import { IFileRepository } from "../../domain/interfaces/IFileRepository";
import {
  FsNodeEntity,
  FileNode,
  DirectoryNode,
  NodeType,
} from "../../domain/entities/FsNode";
import { v4 as uuidv4 } from "uuid";

function dbRun(db: Database, sql: string, params: any[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err: Error | null) => {
      if (err) reject(err);
      resolve();
    });
  });
}

function dbGet(db: Database, sql: string, params: any[] = []): Promise<any> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err: Error | null, row: any) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbAll(db: Database, sql: string, params: any[] = []): Promise<any[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err: Error | null, rows: any[]) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

export class SqliteFileRepository implements IFileRepository {
  private db: Database;
  private inTransaction: boolean = false;

  constructor(db: Database) {
    this.db = db;
  }

  async createFile(file: FileNode): Promise<void> {
    const fileId = uuidv4();
    const createDateStr = file.createDate.toISOString();
    const updateDateStr = file.updateDate.toISOString();

    await dbRun(
      this.db,
      `INSERT INTO files (id, name, path, size, mime_type, create_date, update_date, owner_id, type, blob_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fileId,
        file.name,
        file.path,
        file.size,
        file.mimeType,
        createDateStr,
        updateDateStr,
        file.ownerId,
        NodeType.FILE,
        file.blobId,
      ]
    );
  }

  async createDirectory(directory: DirectoryNode): Promise<void> {
    const dirId = uuidv4();
    const createDate = directory.createDate.toISOString();
    const updateDate = directory.updateDate.toISOString();

    await dbRun(
      this.db,
      `INSERT INTO files (id, name, path, size, mime_type, create_date, update_date, owner_id, type, blob_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dirId,
        directory.name,
        directory.path,
        directory.size,
        directory.mimeType,
        createDate,
        updateDate,
        directory.ownerId,
        NodeType.DIRECTORY,
        null,
      ]
    );
  }

  async findByPath(
    path: string,
    ownerId: string
  ): Promise<FsNodeEntity | null> {
    const row: any = await dbGet(
      this.db,
      `SELECT * FROM files WHERE path = ? AND owner_id = ?`,
      [path, ownerId]
    );

    if (!row) {
      return null;
    }
    return this.rowToEntity(row);
  }

  async findByOwnerAndPathPrefix(
    ownerId: string,
    pathPrefix: string
  ): Promise<FsNodeEntity[]> {
    const rows: any[] = await dbAll(
      this.db,
      `SELECT * FROM files WHERE owner_id = ? AND path LIKE ?`,
      [ownerId, `${pathPrefix}%`]
    );

    return rows.map((row) => this.rowToEntity(row));
  }

  async updateFile(file: FileNode): Promise<void> {
    const updateDateStr = file.updateDate.toISOString();
    await dbRun(
      this.db,
      `UPDATE files SET name = ?, size = ?, mime_type = ?, update_date = ?, blob_id = ?
       WHERE path = ? AND owner_id = ? AND type = ?`,
      [
        file.name,
        file.size,
        file.mimeType,
        updateDateStr,
        file.blobId,
        file.path,
        file.ownerId,
        NodeType.FILE,
      ]
    );
  }

  async updateDirectory(directory: DirectoryNode): Promise<void> {
    const updateDateStr = directory.updateDate.toISOString();

    await dbRun(
      this.db,
      `UPDATE files SET name = ?, update_date = ?
       WHERE path = ? AND owner_id = ? AND type = ?`,
      [
        directory.name,
        updateDateStr,
        directory.path,
        directory.ownerId,
        NodeType.DIRECTORY,
      ]
    );
  }

  async deleteByPath(path: string, ownerId: string): Promise<void> {
    await dbRun(this.db, `DELETE FROM files WHERE path = ? AND owner_id = ?`, [
      path,
      ownerId,
    ]);
  }

  async deleteByPathPrefix(pathPrefix: string, ownerId: string): Promise<void> {
    await dbRun(
      this.db,
      `DELETE FROM files WHERE path LIKE ? AND owner_id = ?`,
      [`${pathPrefix}%`, ownerId]
    );
  }

  async findChildren(path: string, ownerId: string): Promise<FsNodeEntity[]> {
    const parentPath = path === "/" ? "" : path;
    const searchPattern = parentPath === "" ? "/%" : `${parentPath}/%`;
    const rows: any[] = await dbAll(
      this.db,
      `SELECT * FROM files 
       WHERE owner_id = ? AND path LIKE ? AND path != ?
       AND path NOT LIKE ?`,
      [ownerId, searchPattern, path, `${searchPattern}%/%`]
    );

    return rows.map((row) => this.rowToEntity(row));
  }

  async exists(path: string, ownerId: string): Promise<boolean> {
    const row: any = await dbGet(
      this.db,
      `SELECT 1 FROM files WHERE path = ? AND owner_id = ? LIMIT 1`,
      [path, ownerId]
    );
    return !!row;
  }

  async beginTransaction(): Promise<void> {
    if (!this.inTransaction) {
      await dbRun(this.db, "BEGIN TRANSACTION");
      this.inTransaction = true;
    }
  }

  async commitTransaction(): Promise<void> {
    if (this.inTransaction) {
      await dbRun(this.db, "COMMIT");
      this.inTransaction = false;
    }
  }

  async rollbackTransaction(): Promise<void> {
    if (this.inTransaction) {
      await dbRun(this.db, "ROLLBACK");
      this.inTransaction = false;
    }
  }

  private rowToEntity(row: any): FsNodeEntity {
    const baseNode: any = {
      name: row.name,
      path: row.path,
      size: row.size,
      mimeType: row.mime_type,
      createDate: new Date(row.create_date),
      updateDate: new Date(row.update_date),
      ownerId: row.owner_id,
    };

    if (row.type === NodeType.FILE) {
      baseNode.type = NodeType.FILE;
      baseNode.blobId = row.blob_id;
      return baseNode as FileNode;
    } else {
      baseNode.type = NodeType.DIRECTORY;
      return baseNode as DirectoryNode;
    }
  }

}
