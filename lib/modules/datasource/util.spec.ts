import { logger } from '~test/util.ts';
import {
  isCrossOriginPaginationAllowed,
  resolvePaginationUrl,
} from './util.ts';

describe('modules/datasource/util', () => {
  describe('isCrossOriginPaginationAllowed', () => {
    it('returns false when the flag is unset', () => {
      expect(isCrossOriginPaginationAllowed('docker')).toBe(false);
      expect(isCrossOriginPaginationAllowed('nuget')).toBe(false);
    });

    it('returns true only for the opted-in datasource', () => {
      vi.stubEnv('RENOVATE_X_DOCKER_PAGINATION_ALLOW_CROSS_ORIGIN', 'true');
      expect(isCrossOriginPaginationAllowed('docker')).toBe(true);
      // per-datasource: docker's flag must not opt nuget in
      expect(isCrossOriginPaginationAllowed('nuget')).toBe(false);
    });

    it('reads a separate flag for nuget', () => {
      vi.stubEnv('RENOVATE_X_NUGET_PAGINATION_ALLOW_CROSS_ORIGIN', 'true');
      expect(isCrossOriginPaginationAllowed('nuget')).toBe(true);
      expect(isCrossOriginPaginationAllowed('docker')).toBe(false);
    });

    it('returns false for a datasource without a flag', () => {
      expect(isCrossOriginPaginationAllowed('npm')).toBe(false);
    });
  });

  describe('resolvePaginationUrl', () => {
    it('resolves a same-origin link when cross-origin is not allowed', () => {
      expect(
        resolvePaginationUrl(
          'https://reg.example.com/v2/foo?n=10',
          'https://reg.example.com/v2/foo?n=10&last=z',
          false,
        ),
      ).toBe('https://reg.example.com/v2/foo?n=10&last=z');
    });

    it('drops a cross-origin link when cross-origin is not allowed', () => {
      expect(
        resolvePaginationUrl(
          'https://reg.example.com/v2/foo',
          'https://attacker.example.com/v2/foo',
          false,
        ),
      ).toBeNull();
    });

    it('follows a cross-origin link when allowed', () => {
      expect(
        resolvePaginationUrl(
          'https://reg.example.com/v2/foo',
          'https://cdn.example.com/v2/foo?page=2',
          true,
        ),
      ).toBe('https://cdn.example.com/v2/foo?page=2');
    });

    it('logs a warning when following a cross-origin link when allowed', () => {
      resolvePaginationUrl(
        'https://reg.example.com/v2/foo',
        'https://cdn.example.com/v2/foo?page=2',
        true,
      );

      expect(logger.logger.once.warn).toHaveBeenCalledWith(
        {
          baseUrl: 'https://reg.example.com/v2/foo',
          nextUrl: 'https://cdn.example.com/v2/foo?page=2',
        },
        'Following cross-origin pagination link',
      );
    });

    it('resolves a relative link when cross-origin is allowed', () => {
      expect(
        resolvePaginationUrl(
          'https://reg.example.com/v2/foo',
          '/v2/foo?page=2',
          true,
        ),
      ).toBe('https://reg.example.com/v2/foo?page=2');
    });

    it('returns null for an invalid link when cross-origin is allowed', () => {
      expect(
        resolvePaginationUrl('https://reg.example.com/v2/', 'http://', true),
      ).toBeNull();
    });
  });
});
