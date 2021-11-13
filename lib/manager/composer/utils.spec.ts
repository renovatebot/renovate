import { setGlobalConfig } from '../../config/global';
import { extractContraints, getComposerArguments } from './utils';

describe('manager/composer/utils', () => {
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
      expect(getComposerArguments({})).toBe(
        ' --no-ansi --no-interaction --no-scripts --no-autoloader --no-plugins'
      );
    });
    it('disables platform requirements', () => {
      expect(
        getComposerArguments({
          composerIgnorePlatformReqs: [],
        })
      ).toBe(
        ' --ignore-platform-reqs --no-ansi --no-interaction --no-scripts --no-autoloader --no-plugins'
      );
    });
    it('disables single platform requirement', () => {
      expect(
        getComposerArguments({
          composerIgnorePlatformReqs: ['ext-intl'],
        })
      ).toBe(
        ' --ignore-platform-req ext-intl --no-ansi --no-interaction --no-scripts --no-autoloader --no-plugins'
      );
    });
    it('disables multiple platform requirement', () => {
      expect(
        getComposerArguments({
          composerIgnorePlatformReqs: ['ext-intl', 'ext-icu'],
        })
      ).toBe(
        ' --ignore-platform-req ext-intl --ignore-platform-req ext-icu --no-ansi --no-interaction --no-scripts --no-autoloader --no-plugins'
      );
    });
    it('allows scripts/plugins when configured', () => {
      setGlobalConfig({
        allowScripts: true,
      });
      expect(getComposerArguments({})).toBe(' --no-ansi --no-interaction');
    });
    it('disables scripts/plugins when configured locally', () => {
      setGlobalConfig({
        allowScripts: true,
      });
      expect(
        getComposerArguments({
          ignoreScripts: true,
        })
      ).toBe(
        ' --no-ansi --no-interaction --no-scripts --no-autoloader --no-plugins'
      );
    });
  });
});
