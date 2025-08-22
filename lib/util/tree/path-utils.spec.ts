import { reframeRelativePathToRootOfRepo } from './path-utils';

describe('util/tree/path-utils', () => {
  describe('reframeRelativePathToRootOfRepo', () => {
    it('handles relative paths going up one level', () => {
      const result = reframeRelativePathToRootOfRepo(
        'service/go.mod',
        '../common',
      );
      expect(result).toBe('common');
    });

    it('handles relative paths going up multiple levels', () => {
      const result = reframeRelativePathToRootOfRepo(
        'deep/nested/service/go.mod',
        '../../common',
      );
      expect(result).toBe('deep/common');
    });

    it('handles relative paths going down directories', () => {
      const result = reframeRelativePathToRootOfRepo(
        'service/go.mod',
        './internal/utils',
      );
      expect(result).toBe('service/internal/utils');
    });

    it('handles paths that go up to root and then down', () => {
      const result = reframeRelativePathToRootOfRepo(
        'service/go.mod',
        '../shared/utils',
      );
      expect(result).toBe('shared/utils');
    });

    it('handles deeply nested relative paths', () => {
      const result = reframeRelativePathToRootOfRepo(
        'projects/backend/service/go.mod',
        '../../../shared/common',
      );
      expect(result).toBe('shared/common');
    });

    it('handles current directory references', () => {
      const result = reframeRelativePathToRootOfRepo(
        'service/go.mod',
        './local',
      );
      expect(result).toBe('service/local');
    });

    it('handles paths with trailing separators', () => {
      const result = reframeRelativePathToRootOfRepo(
        'service/go.mod',
        '../common/',
      );
      expect(result).toBe('common');
    });

    it('handles root level files with relative paths', () => {
      const result = reframeRelativePathToRootOfRepo('go.mod', './service');
      expect(result).toBe('service');
    });

    it('handles complex nested structures', () => {
      const result = reframeRelativePathToRootOfRepo(
        'apps/web/frontend/package.json',
        '../../shared/components',
      );
      expect(result).toBe('apps/shared/components');
    });

    it('handles edge case with multiple consecutive separators', () => {
      const result = reframeRelativePathToRootOfRepo(
        'service/go.mod',
        '../common',
      );
      expect(result).toBe('common');
    });
  });
});
