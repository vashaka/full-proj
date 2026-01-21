import { Database } from "sqlite3";

function dbRun(db: Database, sql: string, params: any[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err: Error | null) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export class DatabaseFactory {
  static async createDatabase(
    dbPath: string = "./filesystem.db"
  ): Promise<Database> {
    return new Promise((resolve, reject) => {
      const db = new Database(dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(db);
        }
      });
    });
  }

  static async initializeSchema(db: Database): Promise<void> {
    await dbRun(
      db,
      `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `
    );

    await dbRun(
      db,
      `
      CREATE TABLE IF NOT EXISTS files (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL,
        size INTEGER NOT NULL,
        mime_type TEXT NOT NULL,
        create_date TEXT NOT NULL,
        update_date TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        type TEXT NOT NULL,
        blob_id TEXT,
        UNIQUE(path, owner_id),
        FOREIGN KEY (owner_id) REFERENCES users(id)
      )
    `
    );

    await dbRun(
      db,
      `
      CREATE TABLE IF NOT EXISTS blobs (
        blob_id TEXT PRIMARY KEY,
        hash TEXT NOT NULL,
        size INTEGER NOT NULL,
        reference_count INTEGER NOT NULL DEFAULT 0
      )
    `
    );

    await dbRun(
      db,
      `
      CREATE TABLE IF NOT EXISTS blob_content (
        blob_id TEXT PRIMARY KEY,
        content BLOB NOT NULL
      )
    `
    );

    await dbRun(db, `CREATE INDEX IF NOT EXISTS idx_files_path ON files(path)`);
    await dbRun(
      db,
      `CREATE INDEX IF NOT EXISTS idx_files_owner ON files(owner_id)`
    );
    await dbRun(
      db,
      `CREATE INDEX IF NOT EXISTS idx_files_owner_path ON files(owner_id, path)`
    );
    await dbRun(
      db,
      `CREATE INDEX IF NOT EXISTS idx_blobs_reference_count ON blobs(reference_count)`
    );
    await dbRun(
      db,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_blobs_hash ON blobs(hash)`
    );
  }
}
