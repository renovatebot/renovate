import { expect } from 'vitest';
import { NpmUrlHandler } from './npm';

describe('modules/manager/homebrew/handlers/npm', () => {
  const handler = new NpmUrlHandler();

  describe('parseUrl', () => {
    it('returns null for empty string', () => {
      expect(handler.parseUrl('')).toBeNull();
    });

    it.each([null, undefined])(
      'returns null for non-string input: %s',
      (input) => {
        expect(handler.parseUrl(input as never)).toBeNull();
      },
    );

    it('returns null for non-npm registry URL', () => {
      expect(
        handler.parseUrl('https://example.com/package/-/package-1.0.0.tgz'),
      ).toBeNull();
    });

    it('returns null for custom npm registry', () => {
      expect(
        handler.parseUrl(
          'https://registry.company.com/package/-/package-1.0.0.tgz',
        ),
      ).toBeNull();
    });

    it('parses scoped package URL', () => {
      const result = handler.parseUrl(
        'https://registry.npmjs.org/@anthropic-ai/claude-code/-/claude-code-0.1.0.tgz',
      );

      expect(result).toEqual({
        type: 'npm',
        currentValue: '0.1.0',
        packageName: '@anthropic-ai/claude-code',
      });
    });

    it('parses unscoped package URL', () => {
      const result = handler.parseUrl(
        'https://registry.npmjs.org/express/-/express-4.18.2.tgz',
      );

      expect(result).toEqual({
        type: 'npm',
        currentValue: '4.18.2',
        packageName: 'express',
      });
    });

    it('parses version with prerelease', () => {
      const result = handler.parseUrl(
        'https://registry.npmjs.org/package/-/package-1.0.0-beta.1.tgz',
      );

      expect(result).toEqual({
        type: 'npm',
        currentValue: '1.0.0-beta.1',
        packageName: 'package',
      });
    });

    it('parses version with build metadata', () => {
      const result = handler.parseUrl(
        'https://registry.npmjs.org/package/-/package-1.0.0-alpha.2.tgz',
      );

      expect(result).toEqual({
        type: 'npm',
        currentValue: '1.0.0-alpha.2',
        packageName: 'package',
      });
    });

    it('returns null for malformed URL', () => {
      expect(
        handler.parseUrl('https://registry.npmjs.org/invalid-url'),
      ).toBeNull();
    });
  });

  describe('createDependency', () => {
    it('creates dependency with npm datasource for scoped package', () => {
      const parsed = {
        type: 'npm' as const,
        currentValue: '0.1.0',
        packageName: '@anthropic-ai/claude-code',
      };

      const dep = handler.createDependency(
        parsed,
        '345eae3fe4c682df3d8876141f32035bb2898263ce5a406e76e1d74ccb13f601',
        'https://registry.npmjs.org/@anthropic-ai/claude-code/-/claude-code-0.1.0.tgz',
      );

      expect(dep).toMatchObject({
        datasource: 'npm',
        depName: '@anthropic-ai/claude-code',
        currentValue: '0.1.0',
        managerData: {
          type: 'npm',
          packageName: '@anthropic-ai/claude-code',
          sha256:
            '345eae3fe4c682df3d8876141f32035bb2898263ce5a406e76e1d74ccb13f601',
          url: 'https://registry.npmjs.org/@anthropic-ai/claude-code/-/claude-code-0.1.0.tgz',
        },
      });
    });

    it('creates dependency with npm datasource for unscoped package', () => {
      const parsed = {
        type: 'npm' as const,
        currentValue: '4.18.2',
        packageName: 'express',
      };

      const dep = handler.createDependency(
        parsed,
        'abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234',
        'https://registry.npmjs.org/express/-/express-4.18.2.tgz',
      );

      expect(dep).toMatchObject({
        datasource: 'npm',
        depName: 'express',
        currentValue: '4.18.2',
        managerData: {
          type: 'npm',
          packageName: 'express',
          sha256:
            'abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234',
          url: 'https://registry.npmjs.org/express/-/express-4.18.2.tgz',
        },
      });
    });
  });

  describe('buildArchiveUrls', () => {
    it('builds URL for scoped package', () => {
      const managerData = {
        type: 'npm' as const,
        packageName: '@anthropic-ai/claude-code',
        sha256: 'abc123',
        url: 'https://registry.npmjs.org/@anthropic-ai/claude-code/-/claude-code-0.1.0.tgz',
      };

      const urls = handler.buildArchiveUrls(managerData, '0.2.0');

      expect(urls).toEqual([
        'https://registry.npmjs.org/@anthropic-ai/claude-code/-/claude-code-0.2.0.tgz',
      ]);
    });

    it('builds URL for unscoped package', () => {
      const managerData = {
        type: 'npm' as const,
        packageName: 'express',
        sha256: 'abc123',
        url: 'https://registry.npmjs.org/express/-/express-4.18.2.tgz',
      };

      const urls = handler.buildArchiveUrls(managerData, '4.18.3');

      expect(urls).toEqual([
        'https://registry.npmjs.org/express/-/express-4.18.3.tgz',
      ]);
    });

    it('builds URL with prerelease version', () => {
      const managerData = {
        type: 'npm' as const,
        packageName: 'package',
        sha256: 'abc123',
        url: 'https://registry.npmjs.org/package/-/package-1.0.0.tgz',
      };

      const urls = handler.buildArchiveUrls(managerData, '2.0.0-beta.1');

      expect(urls).toEqual([
        'https://registry.npmjs.org/package/-/package-2.0.0-beta.1.tgz',
      ]);
    });

    it('builds URL for deeply scoped package', () => {
      const managerData = {
        type: 'npm' as const,
        packageName: '@scope/package-name',
        sha256: 'abc123',
        url: 'https://registry.npmjs.org/@scope/package-name/-/package-name-1.0.0.tgz',
      };

      const urls = handler.buildArchiveUrls(managerData, '1.1.0');

      expect(urls).toEqual([
        'https://registry.npmjs.org/@scope/package-name/-/package-name-1.1.0.tgz',
      ]);
    });
  });
});
