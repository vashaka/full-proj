import { HashUtils } from '../src/domain/utils/HashUtils';

describe('HashUtils', () => {
  describe('computeHash', () => {
    it('should compute hash for buffer', async () => {
      const buffer = Buffer.from('test content');
      const hash = await HashUtils.computeHash(buffer);
      expect(hash).toBeDefined();
      expect(hash.length).toBe(64); // SHA-256 produces 64 hex characters
    });

    it('should produce same hash for same content', async () => {
      const buffer1 = Buffer.from('test content');
      const buffer2 = Buffer.from('test content');
      const hash1 = await HashUtils.computeHash(buffer1);
      const hash2 = await HashUtils.computeHash(buffer2);
      expect(hash1).toBe(hash2);
    });

    it('should produce different hash for different content', async () => {
      const buffer1 = Buffer.from('test content 1');
      const buffer2 = Buffer.from('test content 2');
      const hash1 = await HashUtils.computeHash(buffer1);
      const hash2 = await HashUtils.computeHash(buffer2);
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('computeHashString', () => {
    it('should compute hash for string', async () => {
      const hash = await HashUtils.computeHashString('test content');
      expect(hash).toBeDefined();
      expect(hash.length).toBe(64);
    });

    it('should produce same hash as computeHash for UTF-8 string', async () => {
      const content = 'test content';
      const hash1 = await HashUtils.computeHashString(content);
      const hash2 = await HashUtils.computeHash(Buffer.from(content, 'utf-8'));
      expect(hash1).toBe(hash2);
    });
  });
});

