import { Database } from "sqlite3";
import { v4 as uuidv4 } from "uuid";

function dbRun(db: Database, sql: string, params: any[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err: Error | null) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

function dbGet(db: Database, sql: string, params: any[] = []): Promise<any> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err: Error | null, row: any) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

export class UserRepository {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async createUser(user: Omit<User, "id" | "createdAt">): Promise<User> {
    const id = uuidv4();
    const createdAt = new Date();
    const createdAtStr = createdAt.toISOString();

    await dbRun(
      this.db,
      `INSERT INTO users (id, username, email, password_hash, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [
        id,
        user.username,
        user.email,
        user.passwordHash,
        createdAtStr,
      ]
    );

    return {
      id: id,
      username: user.username,
      email: user.email,
      passwordHash: user.passwordHash,
      createdAt: createdAt,
    };
  }

  async findByUsername(username: string): Promise<User | null> {
    const row: any = await dbGet(
      this.db,
      `SELECT * FROM users WHERE username = ?`,
      [username]
    );

    if (!row) {
      return null;
    }

    const user: User = {
      id: row.id,
      username: row.username,
      email: row.email,
      passwordHash: row.password_hash,
      createdAt: new Date(row.created_at),
    };
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    const row: any = await dbGet(
      this.db,
      `SELECT * FROM users WHERE email = ?`,
      [email]
    );

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      username: row.username,
      email: row.email,
      passwordHash: row.password_hash,
      createdAt: new Date(row.created_at),
    };
  }

  async findById(id: string): Promise<User | null> {
    const row: any = await dbGet(this.db, `SELECT * FROM users WHERE id = ?`, [
      id,
    ]);

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      username: row.username,
      email: row.email,
      passwordHash: row.password_hash,
      createdAt: new Date(row.created_at),
    };
  }
}
