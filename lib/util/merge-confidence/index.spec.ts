import * as httpMock from '../../../test/http-mock';
import { EXTERNAL_HOST_ERROR } from '../../constants/error-messages';
import { logger } from '../../logger';
import type { HostRule } from '../../types';
import * as memCache from '../cache/memory';
import * as hostRules from '../host-rules';
import {
  getMergeConfidenceLevel,
  initConfig,
  initMergeConfidence,
  isActiveConfidenceLevel,
  resetConfig,
  satisfiesConfidenceLevel,
} from '.';

describe('util/merge-confidence/index', () => {
  const apiBaseUrl = 'https://www.baseurl.com/';
  const defaultApiBaseUrl = 'https://developer.mend.io/';

  describe('isActiveConfidenceLevel()', () => {
    it('returns false if null', () => {
      expect(isActiveConfidenceLevel(null as never)).toBeFalse();
    });

    it('returns false if low', () => {
      expect(isActiveConfidenceLevel('low')).toBeFalse();
    });

    it('returns false if nonsense', () => {
      expect(isActiveConfidenceLevel('nonsense')).toBeFalse();
    });

    it('returns true if valid value (high)', () => {
      expect(isActiveConfidenceLevel('high')).toBeTrue();
    });
  });

  describe('satisfiesConfidenceLevel()', () => {
    it('returns false if less', () => {
      expect(satisfiesConfidenceLevel('low', 'high')).toBeFalse();
    });

    it('returns true if equal', () => {
      expect(satisfiesConfidenceLevel('high', 'high')).toBeTrue();
    });

    it('returns true if more', () => {
      expect(satisfiesConfidenceLevel('very high', 'high')).toBeTrue();
    });
  });

  describe('API calling functions', () => {
    const hostRule: HostRule = {
      hostType: 'merge-confidence',
      token: 'some-token',
    };

    beforeEach(() => {
      process.env.RENOVATE_X_MERGE_CONFIDENCE_API_BASE_URL = apiBaseUrl;
      hostRules.add(hostRule);
      initConfig();
      memCache.reset();
    });

    afterEach(() => {
      hostRules.clear();
      resetConfig();
    });

    describe('getMergeConfidenceLevel()', () => {
      it('returns neutral if undefined updateType', async () => {
        expect(
          await getMergeConfidenceLevel(
            'npm',
            'renovate',
            '25.0.0',
            '25.0.0',
            undefined as never,
          ),
        ).toBe('neutral');
      });

      it('returns neutral if irrelevant updateType', async () => {
        expect(
          await getMergeConfidenceLevel(
            'npm',
            'renovate',
            '24.1.0',
            '25.0.0',
            'bump',
          ),
        ).toBe('neutral');
      });

      it('returns high if pinning', async () => {
        expect(
          await getMergeConfidenceLevel(
            'npm',
            'renovate',
            '25.0.1',
            '25.0.1',
            'pin',
          ),
        ).toBe('high');
      });

      it('returns undefined if no token', async () => {
        resetConfig();
        hostRules.clear();

        expect(
          await getMergeConfidenceLevel(
            'npm',
            'renovate',
            '24.2.0',
            '25.0.0',
            'major',
          ),
        ).toBeUndefined();
      });

      it('returns undefined if datasource is unsupported', async () => {
        expect(
          await getMergeConfidenceLevel(
            'not-npm',
            'renovate',
            '24.2.0',
            '25.0.0',
            'major',
          ),
        ).toBeUndefined();
      });

      it('returns valid confidence level', async () => {
        const datasource = 'npm';
        const depName = 'renovate';
        const currentVersion = '24.3.0';
        const newVersion = '25.0.0';
        httpMock
          .scope(apiBaseUrl)
          .get(
            `/api/mc/json/${datasource}/${depName}/${currentVersion}/${newVersion}`,
          )
          .reply(200, { confidence: 'high' });

        expect(
          await getMergeConfidenceLevel(
            datasource,
            depName,
            currentVersion,
            newVersion,
            'major',
          ),
        ).toBe('high');
      });

      it('escapes a package name containing a forward slash', async () => {
        const datasource = 'npm';
        const packageName = '@jest/global';
        const escapedPackageName = '@jest%2fglobal';
        const currentVersion = '24.3.0';
        const newVersion = '25.0.0';
        httpMock
          .scope(apiBaseUrl)
          .get(
            `/api/mc/json/${datasource}/${escapedPackageName}/${currentVersion}/${newVersion}`,
          )
          .reply(200, { confidence: 'high' });

        expect(
          await getMergeConfidenceLevel(
            datasource,
            packageName,
            currentVersion,
            newVersion,
            'major',
          ),
        ).toBe('high');
      });

      it('returns neutral on invalid merge confidence response from api', async () => {
        const datasource = 'npm';
        const depName = 'renovate';
        const currentVersion = '25.0.0';
        const newVersion = '25.1.0';
        httpMock
          .scope(apiBaseUrl)
          .get(
            `/api/mc/json/${datasource}/${depName}/${currentVersion}/${newVersion}`,
          )
          .reply(200, { invalid: 'invalid' });

        expect(
          await getMergeConfidenceLevel(
            datasource,
            depName,
            currentVersion,
            newVersion,
            'minor',
          ),
        ).toBe('neutral');
      });

      it('returns neutral on non 403/5xx error from API', async () => {
        const datasource = 'npm';
        const depName = 'renovate';
        const currentVersion = '25.0.0';
        const newVersion = '25.4.0';
        httpMock
          .scope(apiBaseUrl)
          .get(
            `/api/mc/json/${datasource}/${depName}/${currentVersion}/${newVersion}`,
          )
          .reply(400);

        expect(
          await getMergeConfidenceLevel(
            datasource,
            depName,
            currentVersion,
            newVersion,
            'minor',
          ),
        ).toBe('neutral');
        expect(logger.warn).toHaveBeenCalledWith(
          expect.anything(),
          'error fetching merge confidence data',
        );
      });

      it('throws on 403-Forbidden response from API', async () => {
        const datasource = 'npm';
        const packageName = 'renovate';
        const currentVersion = '25.0.0';
        const newVersion = '25.4.0';
        httpMock
          .scope(apiBaseUrl)
          .get(
            `/api/mc/json/${datasource}/${packageName}/${currentVersion}/${newVersion}`,
          )
          .reply(403);

        await expect(
          getMergeConfidenceLevel(
            datasource,
            packageName,
            currentVersion,
            newVersion,
            'minor',
          ),
        ).rejects.toThrow(EXTERNAL_HOST_ERROR);
        expect(logger.error).toHaveBeenCalledWith(
          expect.anything(),
          'merge confidence API token rejected - aborting run',
        );
      });

      it('throws on server error responses', async () => {
        const datasource = 'npm';
        const packageName = 'renovate';
        const currentVersion = '25.0.0';
        const newVersion = '25.4.0';
        httpMock
          .scope(apiBaseUrl)
          .get(
            `/api/mc/json/${datasource}/${packageName}/${currentVersion}/${newVersion}`,
          )
          .reply(503);

        await expect(
          getMergeConfidenceLevel(
            datasource,
            packageName,
            currentVersion,
            newVersion,
            'minor',
          ),
        ).rejects.toThrow(EXTERNAL_HOST_ERROR);
        expect(logger.error).toHaveBeenCalledWith(
          expect.anything(),
          'merge confidence API failure: 5xx - aborting run',
        );
      });

      it('returns high if pinning digest', async () => {
        expect(
          await getMergeConfidenceLevel(
            'npm',
            'renovate',
            '25.0.1',
            '25.0.1',
            'pinDigest',
          ),
        ).toBe('high');
      });
    });

    describe('initMergeConfidence()', () => {
      it('using default base url if none is set', async () => {
        resetConfig();
        delete process.env.RENOVATE_X_MERGE_CONFIDENCE_API_BASE_URL;
        httpMock
          .scope(defaultApiBaseUrl)
          .get(`/api/mc/availability`)
          .reply(200);

        await expect(initMergeConfidence()).toResolve();
        expect(logger.trace).toHaveBeenCalledWith(
          'using default merge confidence API base URL',
        );
        expect(logger.debug).toHaveBeenCalledWith(
          'merge confidence API - successfully authenticated',
        );
      });

      it('warns and then resolves if base url is invalid', async () => {
        resetConfig();
        process.env.RENOVATE_X_MERGE_CONFIDENCE_API_BASE_URL =
          'invalid-url.com';
        httpMock
          .scope(defaultApiBaseUrl)
          .get(`/api/mc/availability`)
          .reply(200);

        await expect(initMergeConfidence()).toResolve();
        expect(logger.warn).toHaveBeenCalledWith(
          expect.anything(),
          'invalid merge confidence API base URL found in environment variables - using default value instead',
        );
        expect(logger.debug).toHaveBeenCalledWith(
          'merge confidence API - successfully authenticated',
        );
      });

      it('resolves if no token', async () => {
        resetConfig();
        hostRules.clear();

        await expect(initMergeConfidence()).toResolve();
        expect(logger.trace).toHaveBeenCalledWith(
          'merge confidence API usage is disabled',
        );
      });

      it('resolves when token is valid', async () => {
        httpMock.scope(apiBaseUrl).get(`/api/mc/availability`).reply(200);

        await expect(initMergeConfidence()).toResolve();
        expect(logger.debug).toHaveBeenCalledWith(
          'merge confidence API - successfully authenticated',
        );
      });

      it('throws on 403-Forbidden from mc API', async () => {
        httpMock.scope(apiBaseUrl).get(`/api/mc/availability`).reply(403);

        await expect(initMergeConfidence()).rejects.toThrow(
          EXTERNAL_HOST_ERROR,
        );
        expect(logger.error).toHaveBeenCalledWith(
          expect.anything(),
          'merge confidence API token rejected - aborting run',
        );
      });

      it('throws on 5xx host errors from mc API', async () => {
        httpMock.scope(apiBaseUrl).get(`/api/mc/availability`).reply(503);

        await expect(initMergeConfidence()).rejects.toThrow(
          EXTERNAL_HOST_ERROR,
        );
        expect(logger.error).toHaveBeenCalledWith(
          expect.anything(),
          'merge confidence API failure: 5xx - aborting run',
        );
      });

      it('throws on ECONNRESET', async () => {
        httpMock
          .scope(apiBaseUrl)
          .get(`/api/mc/availability`)
          .replyWithError({ code: 'ECONNRESET' });

        await expect(initMergeConfidence()).rejects.toThrow(
          EXTERNAL_HOST_ERROR,
        );
        expect(logger.error).toHaveBeenCalledWith(
          expect.anything(),
          'merge confidence API request failed - aborting run',
        );
      });
    });
  });
});
