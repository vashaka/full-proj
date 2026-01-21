import { Database } from "sqlite3";
import {
  IBlobRepository,
  BlobReference,
} from "../../domain/interfaces/IBlobRepository";

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

export class SqliteBlobRepository implements IBlobRepository {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async createBlob(blobId: string, hash: string, size: number): Promise<void> {
    await dbRun(
      this.db,
      `INSERT INTO blobs (blob_id, hash, size, reference_count)
       VALUES (?, ?, ?, 1)`,
      [blobId, hash, size]
    );
  }

  async incrementReference(blobId: string): Promise<void> {
    await dbRun(
      this.db,
      `UPDATE blobs SET reference_count = reference_count + 1 WHERE blob_id = ?`,
      [blobId]
    );
  }

  async decrementReference(blobId: string): Promise<number> {
    await dbRun(
      this.db,
      `UPDATE blobs SET reference_count = reference_count - 1 WHERE blob_id = ?`,
      [blobId]
    );

    const row: any = await dbGet(
      this.db,
      `SELECT reference_count FROM blobs WHERE blob_id = ?`,
      [blobId]
    );

    if (row) {
      return row.reference_count;
    }
    return 0;
  }

  async getBlobReference(blobId: string): Promise<BlobReference | null> {
    const row: any = await dbGet(
      this.db,
      `SELECT * FROM blobs WHERE blob_id = ?`,
      [blobId]
    );

    if (!row) {
      return null;
    }

    const blobRef: BlobReference = {
      blobId: row.blob_id,
      referenceCount: row.reference_count,
      size: row.size,
      hash: row.hash,
    };
    return blobRef;
  }

  async deleteBlob(blobId: string): Promise<void> {
    await dbRun(this.db, `DELETE FROM blobs WHERE blob_id = ?`, [blobId]);
  }

  async findOrphanBlobs(): Promise<string[]> {
    const rows: any[] = await dbAll(
      this.db,
      `SELECT blob_id FROM blobs WHERE reference_count <= 0`
    );

    return rows.map((row) => row.blob_id);
  }

  async findByHash(hash: string): Promise<BlobReference | null> {
    const row: any = await dbGet(
      this.db,
      `SELECT * FROM blobs WHERE hash = ? LIMIT 1`,
      [hash]
    );
    if (!row) {
      return null;
    }
    return {
      blobId: row.blob_id,
      referenceCount: row.reference_count,
      size: row.size,
      hash: row.hash,
    };
  }
}
