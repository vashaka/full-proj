export interface IBlobStorage {
  store(blobId: string, content: Buffer): Promise<void>;
  retrieve(blobId: string): Promise<Buffer>;
  delete(blobId: string): Promise<void>;
  exists(blobId: string): Promise<boolean>;
}

