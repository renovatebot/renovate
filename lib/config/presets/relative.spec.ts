import { logger } from '~test/util.ts';
import type { RenovateConfig } from '../types.ts';
import { parsePreset } from './parse.ts';
import { canonicalizeRelativePresets } from './relative.ts';

describe('config/presets/relative', () => {
  describe('canonicalizeRelativePresets', () => {
    it.each`
      parent                                          | input                    | expected
      ${'github>Stedi/renovate-config#v2.0.0'}        | ${'./system/registries'} | ${'github>Stedi/renovate-config//system/registries#v2.0.0'}
      ${'github>some/repo'}                           | ${'./x'}                 | ${'github>some/repo//x'}
      ${'github>some/repo//system/registries#v2.0.0'} | ${'./cache'}             | ${'github>some/repo//system/cache#v2.0.0'}
      ${'github>some/repo//a/b/c#v1'}                 | ${'../shared/x'}         | ${'github>some/repo//a/shared/x#v1'}
      ${'github>some/repo//a/b/c#v1'}                 | ${'/x'}                  | ${'github>some/repo//x#v1'}
      ${'github>some/repo//a/c.json5#v1'}             | ${'./sibling.json5'}     | ${'github>some/repo//a/sibling.json5#v1'}
      ${'github>some/repo:file/sub#v1'}               | ${'./x'}                 | ${'github>some/repo//x#v1'}
      ${'github>some/repo#v1'}                        | ${'./x(p1, p2)'}         | ${'github>some/repo//x#v1(p1, p2)'}
      ${'github>some/repo#v1'}                        | ${'./x()'}               | ${'github>some/repo//x#v1()'}
      ${'github>some/repo//sub/f#v1'}                 | ${'../default'}          | ${'github>some/repo#v1'}
      ${'github>some/repo#v1'}                        | ${'/default'}            | ${'github>some/repo#v1'}
      ${'github>some/repo#v1'}                        | ${'./default'}           | ${'github>some/repo#v1'}
      ${'github>some/repo#v1'}                        | ${'./default(p1)'}       | ${'github>some/repo#v1(p1)'}
      ${'github>some/repo//dir/f#v1'}                 | ${'./default'}           | ${'github>some/repo//dir/default#v1'}
      ${'github>some/repo//sub/f'}                    | ${'./a/../b'}            | ${'github>some/repo//sub/b'}
      ${'github>some/repo//a/b/c#v1'}                 | ${'/nested/dir/x'}       | ${'github>some/repo//nested/dir/x#v1'}
      ${'github>o/r//dir/base#v1'}                    | ${'./g({{ env.T }})'}    | ${'github>o/r//dir/g#v1({{ env.T }})'}
      ${'local>group/repo//presets/base'}             | ${'./extra'}             | ${'local>group/repo//presets/extra'}
      ${'some/repo'}                                  | ${'./x'}                 | ${'local>some/repo//x'}
      ${'gitlab>some/repo#v1'}                        | ${'./x'}                 | ${'gitlab>some/repo//x#v1'}
      ${'gitea>some/repo#v1'}                         | ${'./x'}                 | ${'gitea>some/repo//x#v1'}
      ${'forgejo>some/repo#v1'}                       | ${'./x'}                 | ${'forgejo>some/repo//x#v1'}
    `(
      'resolves $input inside $parent',
      ({ parent, input, expected }: Record<string, string>) => {
        const config: RenovateConfig = { extends: [input] };

        canonicalizeRelativePresets(config, parsePreset(parent));

        expect(config).toEqual({ extends: [expected] });
      },
    );

    it.each`
      parent                        | input          | reason
      ${'github>some/repo#v1'}      | ${'../x'}      | ${'escapes the repository'}
      ${'github>some/repo//a/f#v1'} | ${'../../x'}   | ${'escapes the repository'}
      ${'github>some/repo//a/f#v1'} | ${'./../../x'} | ${'escapes the repository'}
      ${'github>some/repo#v1'}      | ${'./x#v3'}    | ${'invalid tag'}
      ${'github>some/repo#v1'}      | ${'./x:sub'}   | ${'sub-preset'}
      ${'github>some/repo#v1'}      | ${'./.'}       | ${'names a directory'}
      ${'github>some/repo//a/f#v1'} | ${'./..'}      | ${'names a directory'}
    `(
      'leaves $input unchanged inside $parent ($reason)',
      ({ parent, input }: Record<string, string>) => {
        const parsedParent = parsePreset(parent);
        const config: RenovateConfig = { extends: [input] };

        canonicalizeRelativePresets(config, parsedParent);

        expect(config).toEqual({ extends: [input] });
        expect(logger.logger.warn).toHaveBeenCalledWith(
          {
            preset: input,
            parentPreset: parsedParent,
            err: expect.any(Error),
          },
          'Could not resolve relative preset reference',
        );
      },
    );

    const parent = parsePreset('github>some/repo//dir/base#v1.0.0');

    it('rewrites top-level extends', () => {
      const config: RenovateConfig = {
        extends: ['./sibling', '/root/base', '../parent/base'],
      };

      canonicalizeRelativePresets(config, parent);

      expect(config).toEqual({
        extends: [
          'github>some/repo//dir/sibling#v1.0.0',
          'github>some/repo//root/base#v1.0.0',
          'github>some/repo//parent/base#v1.0.0',
        ],
      });
    });

    it('rewrites ignorePresets', () => {
      const config: RenovateConfig = {
        ignorePresets: ['./sibling', 'github>other/repo'],
      };

      canonicalizeRelativePresets(config, parent);

      expect(config).toEqual({
        ignorePresets: [
          'github>some/repo//dir/sibling#v1.0.0',
          'github>other/repo',
        ],
      });
    });

    it('warns about broken ignorePresets entries', () => {
      const parsedParent = parsePreset('github>some/repo#v1');
      const config: RenovateConfig = { ignorePresets: ['../oops'] };

      canonicalizeRelativePresets(config, parsedParent);

      expect(config).toEqual({ ignorePresets: ['../oops'] });
      expect(logger.logger.warn).toHaveBeenCalledWith(
        {
          preset: '../oops',
          parentPreset: parsedParent,
          err: expect.any(Error),
        },
        'Could not resolve relative preset reference',
      );
    });

    it('rewrites extends and ignorePresets of the same object', () => {
      const config: RenovateConfig = {
        extends: ['./optional'],
        ignorePresets: ['./optional'],
      };

      canonicalizeRelativePresets(config, parent);

      expect(config).toEqual({
        extends: ['github>some/repo//dir/optional#v1.0.0'],
        ignorePresets: ['github>some/repo//dir/optional#v1.0.0'],
      });
    });

    it('rewrites nested extends inside packageRules', () => {
      const config: RenovateConfig = {
        packageRules: [
          {
            matchManagers: ['npm'],
            extends: ['./rules/npm'],
          },
        ],
      };

      canonicalizeRelativePresets(config, parent);

      expect(config).toEqual({
        packageRules: [
          {
            matchManagers: ['npm'],
            extends: ['github>some/repo//dir/rules/npm#v1.0.0'],
          },
        ],
      });
    });

    it('rewrites deeply nested extends', () => {
      const config = {
        outer: {
          list: [[{ extends: ['./deep'] }]],
          inner: { extends: ['./inner'] },
        },
      };

      canonicalizeRelativePresets(config, parent);

      expect(config).toEqual({
        outer: {
          list: [[{ extends: ['github>some/repo//dir/deep#v1.0.0'] }]],
          inner: { extends: ['github>some/repo//dir/inner#v1.0.0'] },
        },
      });
    });

    it('rewrites onboardingConfig extends', () => {
      const config: RenovateConfig = {
        onboardingConfig: {
          extends: ['./onboarding'],
        },
      };

      canonicalizeRelativePresets(config, parent);

      expect(config).toEqual({
        onboardingConfig: {
          extends: ['github>some/repo//dir/onboarding#v1.0.0'],
        },
      });
    });

    it('leaves other entries untouched', () => {
      const config = {
        labels: ['dependencies'],
        enabled: true,
        nothing: null,
        extends: [
          'config:recommended',
          'github>other/repo',
          './{{arg0}}',
          './with/{{arg0}}',
          './{{ env.X }}/base',
          42,
        ],
      };

      canonicalizeRelativePresets(config, parent);

      expect(config).toEqual({
        labels: ['dependencies'],
        enabled: true,
        nothing: null,
        extends: [
          'config:recommended',
          'github>other/repo',
          './{{arg0}}',
          './with/{{arg0}}',
          './{{ env.X }}/base',
          42,
        ],
      });
    });

    it('ignores non-array extends', () => {
      const config = { extends: './single' };

      canonicalizeRelativePresets(config, parent);

      expect(config).toEqual({ extends: './single' });
    });
  });
});
