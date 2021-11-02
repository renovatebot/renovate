import { mocked } from '../../../test/util';
import { setGlobalConfig } from '../../config/global';
import * as _datasource from '../../datasource';
import {
  extractContraints,
  getComposerArguments,
  getComposerConstraint,
} from './utils';

jest.mock('../../../lib/datasource');

const datasource = mocked(_datasource);

describe('manager/composer/utils', () => {
  describe('getComposerConstraint', () => {
    beforeEach(() => {
      datasource.getPkgReleases.mockResolvedValueOnce({
        releases: [
          { version: '1.0.0' },
          { version: '1.1.0' },
          { version: '1.3.0' },
          { version: '2.0.14' },
          { version: '2.1.0' },
        ],
      });
    });
    it('returns from config', async () => {
      expect(await getComposerConstraint({ composer: '1.1.0' })).toEqual(
        '1.1.0'
      );
    });

    it('returns from latest', async () => {
      expect(await getComposerConstraint({})).toEqual('2.1.0');
    });

    it('throws no releases', async () => {
      datasource.getPkgReleases.mockReset();
      datasource.getPkgReleases.mockResolvedValueOnce({
        releases: [],
      });
      await expect(getComposerConstraint({})).rejects.toThrow(
        'No composer releases found.'
      );
    });

    it('throws no compatible releases', async () => {
      datasource.getPkgReleases.mockReset();
      datasource.getPkgReleases.mockResolvedValueOnce({
        releases: [{ version: '1.2.3' }],
      });
      await expect(
        getComposerConstraint({ composer: '^3.1.0' })
      ).rejects.toThrow('No compatible composer releases found.');
    });
  });

  describe('extractContraints', () => {
    it('returns from require', () => {
      expect(
        extractContraints(
          { require: { php: '>=5.3.2', 'composer/composer': '1.1.0' } },
          {}
        )
      ).toEqual({ php: '>=5.3.2', composer: '1.1.0' });
    });

    it('returns from require-dev', () => {
      expect(
        extractContraints(
          { 'require-dev': { 'composer/composer': '1.1.0' } },
          {}
        )
      ).toEqual({ composer: '1.1.0' });
    });

    it('returns from composer-runtime-api', () => {
      expect(
        extractContraints({ require: { 'composer-runtime-api': '^1.1.0' } }, {})
      ).toEqual({ composer: '1.*' });
    });

    it('returns from plugin-api-version', () => {
      expect(extractContraints({}, { 'plugin-api-version': '1.1.0' })).toEqual({
        composer: '1.*',
      });
    });

    it('fallback to 1.*', () => {
      expect(extractContraints({}, {})).toEqual({ composer: '1.*' });
    });
  });

  describe('getComposerArguments', () => {
    afterEach(() => {
      setGlobalConfig();
    });

    it('disables scripts and plugins by default', () => {
      expect(getComposerArguments({})).toEqual(
        ' --no-ansi --no-interaction --no-scripts --no-autoloader --no-plugins'
      );
    });
    it('disables platform requirements', () => {
      expect(
        getComposerArguments({
          composerIgnorePlatformReqs: [],
        })
      ).toEqual(
        ' --ignore-platform-reqs --no-ansi --no-interaction --no-scripts --no-autoloader --no-plugins'
      );
    });
    it('disables single platform requirement', () => {
      expect(
        getComposerArguments({
          composerIgnorePlatformReqs: ['ext-intl'],
        })
      ).toEqual(
        ' --ignore-platform-req ext-intl --no-ansi --no-interaction --no-scripts --no-autoloader --no-plugins'
      );
    });
    it('disables multiple platform requirement', () => {
      expect(
        getComposerArguments({
          composerIgnorePlatformReqs: ['ext-intl', 'ext-icu'],
        })
      ).toEqual(
        ' --ignore-platform-req ext-intl --ignore-platform-req ext-icu --no-ansi --no-interaction --no-scripts --no-autoloader --no-plugins'
      );
    });
    it('allows scripts/plugins when configured', () => {
      setGlobalConfig({
        allowScripts: true,
      });
      expect(getComposerArguments({})).toEqual(' --no-ansi --no-interaction');
    });
    it('disables scripts/plugins when configured locally', () => {
      setGlobalConfig({
        allowScripts: true,
      });
      expect(
        getComposerArguments({
          ignoreScripts: true,
        })
      ).toEqual(
        ' --no-ansi --no-interaction --no-scripts --no-autoloader --no-plugins'
      );
    });
  });
});
