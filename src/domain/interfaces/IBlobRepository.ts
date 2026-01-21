export interface BlobReference {
  blobId: string;
  referenceCount: number;
  size: number;
  hash: string;
}

export interface IBlobRepository {
  createBlob(blobId: string, hash: string, size: number): Promise<void>;
  incrementReference(blobId: string): Promise<void>;
  decrementReference(blobId: string): Promise<number>;
  getBlobReference(blobId: string): Promise<BlobReference | null>;
  deleteBlob(blobId: string): Promise<void>;
  findOrphanBlobs(): Promise<string[]>;
  findByHash(hash: string): Promise<BlobReference | null>;
}
