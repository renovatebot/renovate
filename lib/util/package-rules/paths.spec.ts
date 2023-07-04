import { logger } from '../../logger';
import { PathsMatcher } from './paths';

describe('util/package-rules/paths', () => {
  const pathsMatcher = new PathsMatcher();

  describe('match', () => {
    it('should return false if packageFile is not defined', () => {
      const result = pathsMatcher.matches(
        {
          packageFile: undefined,
        },
        {
          matchPaths: ['opentelemetry/http'],
        }
      );
      expect(result).toBeFalse();
    });

    it('should return false on partial match only', () => {
      const result = pathsMatcher.matches(
        {
          packageFile: 'opentelemetry/http/package.json',
        },
        {
          matchPaths: ['opentelemetry/http'],
        }
      );
      expect(result).toBeFalse();
    });

    it('should return true and not log warning on partial and glob match', () => {
      const result = pathsMatcher.matches(
        {
          packageFile: 'package.json',
        },
        {
          matchPaths: ['package.json'],
        }
      );
      expect(result).toBeTrue();
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });
});
