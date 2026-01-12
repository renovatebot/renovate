import { findHandler, findHandlerByType } from '.';

describe('modules/manager/homebrew/handlers/index', () => {
  describe('findHandlerByType', () => {
    it.each(['unknown', ''])('returns null for handler type "%s"', (type) => {
      expect(findHandlerByType(type)).toBeNull();
    });

    it('returns github handler for github type', () => {
      const handler = findHandlerByType('github');
      expect(handler).toMatchObject({ type: 'github' });
    });
  });

  describe('findHandler', () => {
    it('returns null for null URL', () => {
      expect(findHandler(null)).toBeNull();
    });

    it('returns null for unsupported URL', () => {
      expect(findHandler('https://example.com/file.tar.gz')).toBeNull();
    });

    it('returns handler and parsed result for GitHub URL', () => {
      const result = findHandler(
        'https://github.com/aide/aide/releases/download/v0.16.1/aide-0.16.1.tar.gz',
      );

      expect(result).toMatchObject({
        handler: { type: 'github' },
        parsed: {
          type: 'github',
          currentValue: 'v0.16.1',
          ownerName: 'aide',
          repoName: 'aide',
          urlType: 'releases',
        },
      });
    });
  });
});
