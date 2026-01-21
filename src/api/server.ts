import express from "express";
import cors from "cors";
import { Database } from "sqlite3";
import { DatabaseFactory } from "../infrastructure/database/DatabaseFactory";
import { SqliteFileRepository } from "../infrastructure/repositories/SqliteFileRepository";
import { SqliteBlobRepository } from "../infrastructure/repositories/SqliteBlobRepository";
import { LocalBlobStorage } from "../infrastructure/blob-storage/LocalBlobStorage";
import { UserRepository } from "../infrastructure/repositories/UserRepository";
import { FsProviderImpl } from "../application/FsProviderImpl";
import { FsProvider } from "../domain/interfaces/FsProvider";
import { createAuthRouter } from "./routes/auth";
import { createFilesystemRouter } from "./routes/filesystem";

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let db: Database;
let fileRepository: SqliteFileRepository;
let blobRepository: SqliteBlobRepository;
let blobStorage: LocalBlobStorage;
let userRepository: UserRepository;

async function initializeDatabase() {
  const dbPath = "./filesystem.db";
  db = await DatabaseFactory.createDatabase(dbPath);
  await DatabaseFactory.initializeSchema(db);

  fileRepository = new SqliteFileRepository(db);
  blobRepository = new SqliteBlobRepository(db);

  blobStorage = new LocalBlobStorage("./blob-storage");
  await blobStorage.initialize();

  userRepository = new UserRepository(db);
}

async function startServer() {
  try {
    await initializeDatabase();
    app.use("/api/auth", createAuthRouter(userRepository));
    app.use("/api/fs", createFilesystemRouter(getFsProvider));
    app.listen(PORT);
  } catch (error) {
    process.exit(1);
  }
}

function getFsProvider(userId: string): FsProvider {
  return new FsProviderImpl(
    fileRepository,
    blobRepository,
    blobStorage,
    userId
  );
}

startServer();

process.on("SIGINT", () => {
  if (db) {
    db.close(() => {
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});
