import { GlobalConfig } from '../../config/global';
import {
  extractContraints,
  getComposerArguments,
  requireComposerDependencyInstallation,
} from './utils';

jest.mock('../../../lib/datasource');

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

    it('returns from composer platform require', () => {
      expect(
        extractContraints({ require: { php: '^8.1', composer: '2.2.0' } }, {})
      ).toEqual({ php: '^8.1', composer: '2.2.0' });
    });

    it('returns from composer platform require-dev', () => {
      expect(
        extractContraints({ 'require-dev': { composer: '^2.2' } }, {})
      ).toEqual({ composer: '^2.2' });
    });

    it('returns from composer-runtime-api', () => {
      expect(
        extractContraints({ require: { 'composer-runtime-api': '^1.1.0' } }, {})
      ).toEqual({ composer: '^1.1' });
    });

    it('returns from plugin-api-version', () => {
      expect(extractContraints({}, { 'plugin-api-version': '1.1.0' })).toEqual({
        composer: '^1.1',
      });
    });

    it('fallback to 1.*', () => {
      expect(extractContraints({}, {})).toEqual({ composer: '1.*' });
    });
  });

  describe('getComposerArguments', () => {
    afterEach(() => {
      GlobalConfig.reset();
    });

    it('disables scripts and plugins by default', () => {
      expect(
        getComposerArguments({}, { toolName: 'composer', constraint: '1.*' })
      ).toBe(
        ' --no-ansi --no-interaction --no-scripts --no-autoloader --no-plugins'
      );
    });
    it('disables platform requirements', () => {
      expect(
        getComposerArguments(
          {
            composerIgnorePlatformReqs: [],
          },
          { toolName: 'composer', constraint: '1.*' }
        )
      ).toBe(
        ' --ignore-platform-reqs --no-ansi --no-interaction --no-scripts --no-autoloader --no-plugins'
      );
    });
    it('disables all platform requirements with 2.1.0', () => {
      expect(
        getComposerArguments(
          {
            composerIgnorePlatformReqs: [],
          },
          { toolName: 'composer', constraint: '2.1.0' }
        )
      ).toBe(
        ' --ignore-platform-reqs --no-ansi --no-interaction --no-scripts --no-autoloader --no-plugins'
      );
    });
    it('disables only extension and library platform requirements with 2.2.0', () => {
      expect(
        getComposerArguments(
          {
            composerIgnorePlatformReqs: [],
          },
          { toolName: 'composer', constraint: '2.2.0' }
        )
      ).toBe(
        " --ignore-platform-req='ext-*' --ignore-platform-req='lib-*' --no-ansi --no-interaction --no-scripts --no-autoloader --no-plugins"
      );
    });
    it('disables only extension and library platform requirements with ^2.2', () => {
      expect(
        getComposerArguments(
          {
            composerIgnorePlatformReqs: [],
          },
          { toolName: 'composer', constraint: '^2.2' }
        )
      ).toBe(
        " --ignore-platform-req='ext-*' --ignore-platform-req='lib-*' --no-ansi --no-interaction --no-scripts --no-autoloader --no-plugins"
      );
    });
    it('disables single platform requirement', () => {
      expect(
        getComposerArguments(
          {
            composerIgnorePlatformReqs: ['ext-intl'],
          },
          { toolName: 'composer', constraint: '1.*' }
        )
      ).toBe(
        ' --ignore-platform-req ext-intl --no-ansi --no-interaction --no-scripts --no-autoloader --no-plugins'
      );
    });
    it('disables multiple platform requirement', () => {
      expect(
        getComposerArguments(
          {
            composerIgnorePlatformReqs: ['ext-intl', 'ext-icu'],
          },
          { toolName: 'composer', constraint: '1.*' }
        )
      ).toBe(
        ' --ignore-platform-req ext-intl --ignore-platform-req ext-icu --no-ansi --no-interaction --no-scripts --no-autoloader --no-plugins'
      );
    });
    it('allows scripts when configured', () => {
      GlobalConfig.set({
        allowScripts: true,
      });
      expect(
        getComposerArguments({}, { toolName: 'composer', constraint: '1.*' })
      ).toBe(' --no-ansi --no-interaction --no-plugins');
    });
    it('disables scripts when configured locally', () => {
      GlobalConfig.set({
        allowScripts: true,
      });
      expect(
        getComposerArguments(
          {
            ignoreScripts: true,
          },
          { toolName: 'composer', constraint: '1.*' }
        )
      ).toBe(
        ' --no-ansi --no-interaction --no-scripts --no-autoloader --no-plugins'
      );
    });
    it('allows plugins when configured', () => {
      GlobalConfig.set({
        allowPlugins: true,
      });
      expect(
        getComposerArguments({}, { toolName: 'composer', constraint: '1.*' })
      ).toBe(' --no-ansi --no-interaction --no-scripts --no-autoloader');
    });
    it('disables plugins when configured locally', () => {
      GlobalConfig.set({
        allowPlugins: true,
      });
      expect(
        getComposerArguments(
          {
            ignorePlugins: true,
          },
          { toolName: 'composer', constraint: '1.*' }
        )
      ).toBe(
        ' --no-ansi --no-interaction --no-scripts --no-autoloader --no-plugins'
      );
    });
  });

  describe('requireComposerDependencyInstallation', () => {
    it('returns true when symfony/flex has been installed', () => {
      expect(
        requireComposerDependencyInstallation({
          packages: [{ name: 'symfony/flex', version: '1.17.1' }],
        })
      ).toBeTrue();
    });

    it('returns true when symfony/flex has been installed as dev dependency', () => {
      expect(
        requireComposerDependencyInstallation({
          'packages-dev': [{ name: 'symfony/flex', version: '1.17.1' }],
        })
      ).toBeTrue();
    });

    it('returns false when symfony/flex has not been installed', () => {
      expect(
        requireComposerDependencyInstallation({
          packages: [{ name: 'symfony/console', version: '5.4.0' }],
        })
      ).toBeFalse();
    });
  });
});
