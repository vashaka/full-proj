import { FsProviderImpl } from '../src/application/FsProviderImpl';
import { IFileRepository } from '../src/domain/interfaces/IFileRepository';
import { IBlobRepository } from '../src/domain/interfaces/IBlobRepository';
import { IBlobStorage } from '../src/domain/interfaces/IBlobStorage';
import { FileNode, DirectoryNode, NodeType } from '../src/domain/entities/FsNode';

describe('FsProviderImpl', () => {
  let fileRepository: jest.Mocked<IFileRepository>;
  let blobRepository: jest.Mocked<IBlobRepository>;
  let blobStorage: jest.Mocked<IBlobStorage>;
  let fsProvider: FsProviderImpl;
  const ownerId = 'test-user-id';

  beforeEach(() => {
    fileRepository = {
      createFile: jest.fn(),
      createDirectory: jest.fn(),
      findByPath: jest.fn(),
      findByOwnerAndPathPrefix: jest.fn(),
      updateFile: jest.fn(),
      updateDirectory: jest.fn(),
      deleteByPath: jest.fn(),
      deleteByPathPrefix: jest.fn(),
      findChildren: jest.fn(),
      exists: jest.fn(),
      beginTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
    };

    blobRepository = {
      createBlob: jest.fn(),
      incrementReference: jest.fn(),
      decrementReference: jest.fn(),
      getBlobReference: jest.fn(),
      deleteBlob: jest.fn(),
      findOrphanBlobs: jest.fn(),
      findByHash: jest.fn(),
    };

    blobStorage = {
      store: jest.fn(),
      retrieve: jest.fn(),
      delete: jest.fn(),
      exists: jest.fn(),
    };

    fsProvider = new FsProviderImpl(
      fileRepository,
      blobRepository,
      blobStorage,
      ownerId
    );
  });

  describe('createDirectory', () => {
    it('should create directory', async () => {
      fileRepository.exists.mockResolvedValue(false);
      fileRepository.findByPath.mockResolvedValue(null);

      await fsProvider.createDirectory('/test');

      expect(fileRepository.createDirectory).toHaveBeenCalledWith(
        expect.objectContaining({
          path: '/test',
          type: NodeType.DIRECTORY,
          ownerId,
        })
      );
    });

    it('should create parent directories recursively', async () => {
      fileRepository.exists
        .mockResolvedValueOnce(false) // /test doesn't exist
        .mockResolvedValueOnce(false); // / doesn't exist (but it's root, so this won't be called)
      fileRepository.findByPath.mockResolvedValue(null);

      await fsProvider.createDirectory('/test/nested');

      expect(fileRepository.createDirectory).toHaveBeenCalledTimes(2);
    });
  });

  describe('writeFile', () => {
    it('should create new file', async () => {
      const content = 'test content';
      fileRepository.exists.mockResolvedValue(false);
      fileRepository.findByPath.mockResolvedValue(null);
      blobRepository.findByHash.mockResolvedValue(null);

      await fsProvider.writeFile('/test.txt', content);

      expect(blobStorage.store).toHaveBeenCalled();
      expect(blobRepository.createBlob).toHaveBeenCalled();
      expect(fileRepository.createFile).toHaveBeenCalled();
    });

    it('should reuse blob for duplicate content', async () => {
      const content = 'test content';
      const existingBlobId = 'existing-blob-id';
      fileRepository.exists.mockResolvedValue(false);
      fileRepository.findByPath.mockResolvedValue(null);
      blobRepository.findByHash.mockResolvedValue({
        blobId: existingBlobId,
        hash: 'hash',
        referenceCount: 1,
        size: content.length,
      });

      await fsProvider.writeFile('/test.txt', content);

      expect(blobStorage.store).not.toHaveBeenCalled();
      expect(blobRepository.incrementReference).toHaveBeenCalledWith(existingBlobId);
    });
  });

  describe('readFile', () => {
    it('should read file content', async () => {
      const fileNode: FileNode = {
        name: 'test.txt',
        path: '/test.txt',
        size: 12,
        mimeType: 'text/plain',
        createDate: new Date(),
        updateDate: new Date(),
        ownerId,
        type: NodeType.FILE,
        blobId: 'blob-id',
      };

      fileRepository.findByPath.mockResolvedValue(fileNode);
      blobStorage.retrieve.mockResolvedValue(Buffer.from('test content'));

      const content = await fsProvider.readFile('/test.txt');

      expect(blobStorage.retrieve).toHaveBeenCalledWith('blob-id');
      expect(content).toBe('test content');
    });
  });

  describe('deleteFile', () => {
    it('should delete file and cleanup blob if no references', async () => {
      const fileNode: FileNode = {
        name: 'test.txt',
        path: '/test.txt',
        size: 12,
        mimeType: 'text/plain',
        createDate: new Date(),
        updateDate: new Date(),
        ownerId,
        type: NodeType.FILE,
        blobId: 'blob-id',
      };

      fileRepository.findByPath.mockResolvedValue(fileNode);
      blobRepository.decrementReference.mockResolvedValue(0);

      await fsProvider.deleteFile('/test.txt');

      expect(fileRepository.deleteByPath).toHaveBeenCalledWith('/test.txt', ownerId);
      expect(blobStorage.delete).toHaveBeenCalledWith('blob-id');
      expect(blobRepository.deleteBlob).toHaveBeenCalledWith('blob-id');
    });

    it('should not delete blob if references remain', async () => {
      const fileNode: FileNode = {
        name: 'test.txt',
        path: '/test.txt',
        size: 12,
        mimeType: 'text/plain',
        createDate: new Date(),
        updateDate: new Date(),
        ownerId,
        type: NodeType.FILE,
        blobId: 'blob-id',
      };

      fileRepository.findByPath.mockResolvedValue(fileNode);
      blobRepository.decrementReference.mockResolvedValue(1);

      await fsProvider.deleteFile('/test.txt');

      expect(blobStorage.delete).not.toHaveBeenCalled();
      expect(blobRepository.deleteBlob).not.toHaveBeenCalled();
    });
  });

  describe('listDirectory', () => {
    it('should list directory contents', async () => {
      const dirNode: DirectoryNode = {
        name: 'test',
        path: '/test',
        size: 0,
        mimeType: 'inode/directory',
        createDate: new Date(),
        updateDate: new Date(),
        ownerId,
        type: NodeType.DIRECTORY,
      };

      const child1: FileNode = {
        name: 'file1.txt',
        path: '/test/file1.txt',
        size: 10,
        mimeType: 'text/plain',
        createDate: new Date(),
        updateDate: new Date(),
        ownerId,
        type: NodeType.FILE,
        blobId: 'blob1',
      };

      fileRepository.findByPath.mockResolvedValue(dirNode);
      fileRepository.findChildren.mockResolvedValue([child1]);

      const nodes = await fsProvider.listDirectory('/test');

      expect(nodes).toHaveLength(1);
      expect(nodes[0].name).toBe('file1.txt');
    });
  });

  describe('copyFile', () => {
    it('should copy file', async () => {
      const sourceNode: FileNode = {
        name: 'test.txt',
        path: '/test.txt',
        size: 12,
        mimeType: 'text/plain',
        createDate: new Date(),
        updateDate: new Date(),
        ownerId,
        type: NodeType.FILE,
        blobId: 'blob-id',
      };

      fileRepository.findByPath.mockResolvedValue(sourceNode);
      blobStorage.retrieve.mockResolvedValue(Buffer.from('test content'));
      fileRepository.exists.mockResolvedValue(false);
      blobRepository.findByHash.mockResolvedValue(null);

      await fsProvider.copyFile('/test.txt', '/copy.txt');

      expect(fileRepository.createFile).toHaveBeenCalledWith(
        expect.objectContaining({
          path: '/copy.txt',
        })
      );
    });
  });

  describe('moveFile', () => {
    it('should move file', async () => {
      const sourceNode: FileNode = {
        name: 'test.txt',
        path: '/test.txt',
        size: 12,
        mimeType: 'text/plain',
        createDate: new Date(),
        updateDate: new Date(),
        ownerId,
        type: NodeType.FILE,
        blobId: 'blob-id',
      };

      fileRepository.findByPath.mockResolvedValue(sourceNode);
      fileRepository.beginTransaction.mockResolvedValue();
      fileRepository.commitTransaction.mockResolvedValue();

      await fsProvider.moveFile('/test.txt', '/moved.txt');

      expect(fileRepository.deleteByPath).toHaveBeenCalledWith('/test.txt', ownerId);
      expect(fileRepository.createFile).toHaveBeenCalledWith(
        expect.objectContaining({
          path: '/moved.txt',
        })
      );
    });
  });

  describe('getWorkingDirectory', () => {
    it('should return default working directory', async () => {
      const workingDir = await fsProvider.getWorkingDirectory();
      expect(workingDir).toBe('/');
    });
  });

  describe('setWorkingDirectory', () => {
    it('should set working directory', async () => {
      const dirNode: DirectoryNode = {
        name: 'test',
        path: '/test',
        size: 0,
        mimeType: 'inode/directory',
        createDate: new Date(),
        updateDate: new Date(),
        ownerId,
        type: NodeType.DIRECTORY,
      };

      fileRepository.findByPath.mockResolvedValue(dirNode);

      await fsProvider.setWorkingDirectory('/test');
      const workingDir = await fsProvider.getWorkingDirectory();

      expect(workingDir).toBe('/test');
    });
  });

  describe('deleteDirectory', () => {
    it('should delete directory and cleanup blobs', async () => {
      const dirNode: DirectoryNode = {
        name: 'test',
        path: '/test',
        size: 0,
        mimeType: 'inode/directory',
        createDate: new Date(),
        updateDate: new Date(),
        ownerId,
        type: NodeType.DIRECTORY,
      };

      const childFile: FileNode = {
        name: 'file.txt',
        path: '/test/file.txt',
        size: 10,
        mimeType: 'text/plain',
        createDate: new Date(),
        updateDate: new Date(),
        ownerId,
        type: NodeType.FILE,
        blobId: 'blob-id',
      };

      fileRepository.findByPath.mockResolvedValue(dirNode);
      fileRepository.findByOwnerAndPathPrefix.mockResolvedValue([childFile]);
      fileRepository.beginTransaction.mockResolvedValue();
      fileRepository.commitTransaction.mockResolvedValue();
      blobRepository.decrementReference.mockResolvedValue(0);

      await fsProvider.deleteDirectory('/test');

      expect(fileRepository.deleteByPathPrefix).toHaveBeenCalledWith('/test', ownerId);
      expect(blobStorage.delete).toHaveBeenCalledWith('blob-id');
      expect(blobRepository.deleteBlob).toHaveBeenCalledWith('blob-id');
    });
  });

  describe('copyDirectory', () => {
    it('should copy directory recursively', async () => {
      const sourceDir: DirectoryNode = {
        name: 'test',
        path: '/test',
        size: 0,
        mimeType: 'inode/directory',
        createDate: new Date(),
        updateDate: new Date(),
        ownerId,
        type: NodeType.DIRECTORY,
      };

      const childFile: FileNode = {
        name: 'file.txt',
        path: '/test/file.txt',
        size: 10,
        mimeType: 'text/plain',
        createDate: new Date(),
        updateDate: new Date(),
        ownerId,
        type: NodeType.FILE,
        blobId: 'blob-id',
      };

      fileRepository.findByPath.mockResolvedValue(sourceDir);
      fileRepository.findByOwnerAndPathPrefix.mockResolvedValue([childFile]);
      fileRepository.exists.mockResolvedValue(false);
      fileRepository.beginTransaction.mockResolvedValue();
      fileRepository.commitTransaction.mockResolvedValue();
      blobStorage.retrieve.mockResolvedValue(Buffer.from('content'));
      blobRepository.findByHash.mockResolvedValue(null);

      await fsProvider.copyDirectory('/test', '/copy');

      expect(fileRepository.createDirectory).toHaveBeenCalledWith(
        expect.objectContaining({ path: '/copy' })
      );
      expect(fileRepository.createFile).toHaveBeenCalledWith(
        expect.objectContaining({ path: '/copy/file.txt' })
      );
    });
  });

  describe('moveDirectory', () => {
    it('should move directory recursively', async () => {
      const sourceDir: DirectoryNode = {
        name: 'test',
        path: '/test',
        size: 0,
        mimeType: 'inode/directory',
        createDate: new Date(),
        updateDate: new Date(),
        ownerId,
        type: NodeType.DIRECTORY,
      };

      const childFile: FileNode = {
        name: 'file.txt',
        path: '/test/file.txt',
        size: 10,
        mimeType: 'text/plain',
        createDate: new Date(),
        updateDate: new Date(),
        ownerId,
        type: NodeType.FILE,
        blobId: 'blob-id',
      };

      fileRepository.findByPath.mockResolvedValue(sourceDir);
      fileRepository.findByOwnerAndPathPrefix.mockResolvedValue([childFile]);
      fileRepository.beginTransaction.mockResolvedValue();
      fileRepository.commitTransaction.mockResolvedValue();

      await fsProvider.moveDirectory('/test', '/moved');

      expect(fileRepository.createDirectory).toHaveBeenCalledWith(
        expect.objectContaining({ path: '/moved' })
      );
      expect(fileRepository.deleteByPath).toHaveBeenCalledWith('/test', ownerId);
    });
  });

  describe('getInfo', () => {
    it('should return file info', async () => {
      const fileNode: FileNode = {
        name: 'test.txt',
        path: '/test.txt',
        size: 12,
        mimeType: 'text/plain',
        createDate: new Date('2023-01-01'),
        updateDate: new Date('2023-01-02'),
        ownerId,
        type: NodeType.FILE,
        blobId: 'blob-id',
      };

      fileRepository.findByPath.mockResolvedValue(fileNode);

      const info = await fsProvider.getInfo('/test.txt');

      expect(info.name).toBe('test.txt');
      expect(info.path).toBe('/test.txt');
      expect(info.size).toBe(12);
      expect(info.mimeType).toBe('text/plain');
    });

    it('should return directory info', async () => {
      const dirNode: DirectoryNode = {
        name: 'test',
        path: '/test',
        size: 0,
        mimeType: 'inode/directory',
        createDate: new Date('2023-01-01'),
        updateDate: new Date('2023-01-02'),
        ownerId,
        type: NodeType.DIRECTORY,
      };

      fileRepository.findByPath.mockResolvedValue(dirNode);

      const info = await fsProvider.getInfo('/test');

      expect(info.name).toBe('test');
      expect(info.path).toBe('/test');
      expect(info.mimeType).toBe('inode/directory');
    });
  });

  describe('cleanupOrphanBlobs', () => {
    it('should delete orphan blobs', async () => {
      const orphanBlobs = ['blob1', 'blob2'];
      blobRepository.findOrphanBlobs.mockResolvedValue(orphanBlobs);
      blobStorage.delete.mockResolvedValue();
      blobRepository.deleteBlob.mockResolvedValue();

      await fsProvider.cleanupOrphanBlobs();

      expect(blobStorage.delete).toHaveBeenCalledTimes(2);
      expect(blobRepository.deleteBlob).toHaveBeenCalledTimes(2);
      expect(blobStorage.delete).toHaveBeenCalledWith('blob1');
      expect(blobStorage.delete).toHaveBeenCalledWith('blob2');
    });

    it('should handle errors when deleting orphan blobs', async () => {
      const orphanBlobs = ['blob1'];
      blobRepository.findOrphanBlobs.mockResolvedValue(orphanBlobs);
      blobStorage.delete.mockRejectedValue(new Error('Delete failed'));

      await fsProvider.cleanupOrphanBlobs();

      expect(blobStorage.delete).toHaveBeenCalledWith('blob1');
    });
  });
});

