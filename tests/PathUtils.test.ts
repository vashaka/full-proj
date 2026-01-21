import { PathUtils } from '../src/domain/utils/PathUtils';

describe('PathUtils', () => {
  describe('normalize', () => {
    it('should normalize empty path to root', () => {
      expect(PathUtils.normalize('')).toBe('/');
    });

    it('should normalize path with trailing slashes', () => {
      expect(PathUtils.normalize('/path/to/dir/')).toBe('/path/to/dir');
    });

    it('should normalize path with multiple slashes', () => {
      expect(PathUtils.normalize('/path//to///dir')).toBe('/path/to/dir');
    });

    it('should ensure path starts with /', () => {
      expect(PathUtils.normalize('path/to/dir')).toBe('/path/to/dir');
    });

    it('should keep root as /', () => {
      expect(PathUtils.normalize('/')).toBe('/');
    });
  });

  describe('join', () => {
    it('should join multiple path parts', () => {
      expect(PathUtils.join('path', 'to', 'dir')).toBe('/path/to/dir');
    });

    it('should handle empty parts', () => {
      expect(PathUtils.join('path', '', 'dir')).toBe('/path/dir');
    });

    it('should normalize the result', () => {
      expect(PathUtils.join('path/', '/to', 'dir/')).toBe('/path/to/dir');
    });
  });

  describe('dirname', () => {
    it('should return parent directory', () => {
      expect(PathUtils.dirname('/path/to/file')).toBe('/path/to');
    });

    it('should return root for root path', () => {
      expect(PathUtils.dirname('/')).toBe('/');
    });

    it('should return root for single level path', () => {
      expect(PathUtils.dirname('/file')).toBe('/');
    });
  });

  describe('basename', () => {
    it('should return filename', () => {
      expect(PathUtils.basename('/path/to/file.txt')).toBe('file.txt');
    });

    it('should return directory name', () => {
      expect(PathUtils.basename('/path/to/dir')).toBe('dir');
    });

    it('should return root for root path', () => {
      expect(PathUtils.basename('/')).toBe('/');
    });
  });

  describe('isAncestor', () => {
    it('should return true for valid ancestor', () => {
      expect(PathUtils.isAncestor('/path', '/path/to/file')).toBe(true);
    });

    it('should return false for non-ancestor', () => {
      expect(PathUtils.isAncestor('/path', '/other/path')).toBe(false);
    });

    it('should return true when root is ancestor', () => {
      expect(PathUtils.isAncestor('/', '/any/path')).toBe(true);
    });

    it('should return false when paths are equal', () => {
      expect(PathUtils.isAncestor('/path', '/path')).toBe(false);
    });
  });

  describe('resolve', () => {
    it('should resolve relative path', () => {
      expect(PathUtils.resolve('/current/dir', 'file.txt')).toBe('/current/dir/file.txt');
    });

    it('should return absolute path as is', () => {
      expect(PathUtils.resolve('/current/dir', '/absolute/path')).toBe('/absolute/path');
    });

    it('should handle root working directory', () => {
      expect(PathUtils.resolve('/', 'file.txt')).toBe('/file.txt');
    });
  });
});

