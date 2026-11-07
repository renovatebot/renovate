import type { DefaultedConfigKey } from './defaults.ts';
import { getConfig, isDefaultedOption } from './defaults.ts';
import { filterConfig } from './index.ts';
import { getOptions } from './options/index.ts';
import type { FilteredConfigKey } from './stages.ts';
import { isFilteredOption } from './stages.ts';
import type { RenovateOptions } from './types.ts';

describe('config/stages', () => {
  describe('isFilteredOption()', () => {
    const option: RenovateOptions = {
      name: 'thing',
      description: 'thing',
      type: 'boolean',
      stage: 'package',
      scopes: ['repo'],
    };

    it.each`
      targetStage     | expected
      ${'global'}     | ${false}
      ${'repository'} | ${false}
      ${'package'}    | ${false}
      ${'branch'}     | ${true}
      ${'pr'}         | ${true}
    `(
      'is $expected for a package option and the $targetStage stage',
      ({ targetStage, expected }) => {
        expect(isFilteredOption(option, targetStage)).toBe(expected);
      },
    );

    it('is false for an option without a stage', () => {
      expect(
        isFilteredOption({ ...option, stage: undefined }, 'pr'),
      ).toBeFalse();
    });
  });

  describe('FilteredConfigKey', () => {
    it('matches the options with a default which filterConfig() deletes for the repository stage', () => {
      const expected = [
        'autodiscover',
        'forceCli',
        'gitNoVerify',
        'mergeConfidenceDatasources',
        'mergeConfidenceEndpoint',
        'prCommitsPerRunLimit',
        'processEnv',
        'repositories',
      ] as const;

      const config = filterConfig(getConfig(), 'repository');
      const deleted = getOptions()
        .filter(isDefaultedOption)
        .map((option) => option.name)
        .filter((name) => !(name in config));

      expect(deleted).toIncludeSameMembers([...expected]);
      expectTypeOf<
        Extract<FilteredConfigKey<'repository'>, DefaultedConfigKey>
      >().toEqualTypeOf<(typeof expected)[number]>();
    });

    it('is empty for the global stage', () => {
      expectTypeOf<FilteredConfigKey<'global'>>().toBeNever();
    });
  });
});
