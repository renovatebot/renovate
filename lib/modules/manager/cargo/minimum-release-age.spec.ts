import { codeBlock } from 'common-tags';
import { fs, logger } from '~test/util.ts';
import type { Timestamp } from '../../../util/timestamp.ts';
import { CrateDatasource } from '../../datasource/crate/index.ts';
import type { Upgrade } from '../types.ts';
import {
  enforcesMinimumReleaseAge,
  getGlobalMinPublishAge,
  getMinPublishAgeEnv,
  getMinPublishAgeRules,
  getRegistryMinPublishAges,
} from './minimum-release-age.ts';
import type { CargoManagerData, MinPublishAgeEnv } from './types.ts';

vi.mock('../../../util/fs/index.ts');

const dayMs = 24 * 60 * 60 * 1000;

function daysAgo(days: number): Timestamp {
  return new Date(Date.now() - days * dayMs).toISOString() as Timestamp;
}

describe('modules/manager/cargo/minimum-release-age', () => {
  describe('getGlobalMinPublishAge()', () => {
    it.each`
      age           | expected
      ${'3 days'}   | ${'3 days'}
      ${'2 weeks'}  | ${'2 weeks'}
      ${'1 months'} | ${'2629746 seconds'}
      ${'2month'}   | ${'5259492 seconds'}
      ${'1 day'}    | ${'1 day'}
      ${'36hours'}  | ${'36hours'}
      ${'0'}        | ${null}
      ${'0 days'}   | ${null}
      ${''}         | ${null}
      ${'invalid'}  | ${null}
      ${'3d'}       | ${null}
      ${'1.5 days'} | ${null}
      ${'1 Day'}    | ${null}
      ${'3  days'}  | ${null}
      ${'1M'}       | ${null}
      ${undefined}  | ${null}
    `('returns $expected for $age', ({ age, expected }) => {
      expect(
        getGlobalMinPublishAge({
          registry: { 'global-min-publish-age': age },
        }),
      ).toBe(expected);
    });

    it('returns null without a registry section', () => {
      expect(getGlobalMinPublishAge({})).toBeNull();
    });

    it('logs an invalid value', () => {
      getGlobalMinPublishAge({ registry: { 'global-min-publish-age': 'x' } });
      expect(logger.logger.debug).toHaveBeenCalledWith(
        'Invalid registry.global-min-publish-age in cargo config: x',
      );
    });
  });

  describe('getMinPublishAgeRules()', () => {
    const urls = {
      'my-reg': 'sparse+https://my-reg.example.com/index/',
      'other-reg': 'https://other-reg.example.com/index',
    };

    it('applies the global age to every crate', () => {
      expect(
        getMinPublishAgeRules(
          { registry: { 'global-min-publish-age': '7 days' } },
          {},
        ),
      ).toEqual([
        { matchDatasources: ['crate'], minimumReleaseAgeExtracted: '7 days' },
      ]);
    });

    it('applies the age of each registry over the global age', () => {
      expect(
        getMinPublishAgeRules(
          {
            registry: { 'global-min-publish-age': '7 days' },
            registries: {
              'crates-io': { 'min-publish-age': '1 day' },
              'my-reg': { 'min-publish-age': '0' },
            },
          },
          urls,
        ),
      ).toEqual([
        { matchDatasources: ['crate'], minimumReleaseAgeExtracted: '1 day' },
        {
          matchDatasources: ['crate'],
          matchRegistryUrls: ['sparse+https://my-reg.example.com/index/'],
          minimumReleaseAgeExtracted: null,
        },
        {
          matchDatasources: ['crate'],
          matchRegistryUrls: ['https://other-reg.example.com/index'],
          minimumReleaseAgeExtracted: '7 days',
        },
      ]);
    });

    it('applies the age of a registry without an age for crates.io', () => {
      expect(
        getMinPublishAgeRules(
          {
            registries: {
              'crates-io': { 'min-publish-age': '0' },
              'my-reg': { 'min-publish-age': '2 days' },
            },
          },
          urls,
        ),
      ).toEqual([
        {
          matchDatasources: ['crate'],
          matchRegistryUrls: ['sparse+https://my-reg.example.com/index/'],
          minimumReleaseAgeExtracted: '2 days',
        },
      ]);
    });

    it('ignores an invalid age of a registry', () => {
      expect(
        getMinPublishAgeRules(
          {
            registry: { 'global-min-publish-age': '7 days' },
            registries: { 'my-reg': { 'min-publish-age': 'invalid' } },
          },
          { 'my-reg': urls['my-reg'] },
        ),
      ).toEqual([
        { matchDatasources: ['crate'], minimumReleaseAgeExtracted: '7 days' },
        {
          matchDatasources: ['crate'],
          matchRegistryUrls: ['sparse+https://my-reg.example.com/index/'],
          minimumReleaseAgeExtracted: '7 days',
        },
      ]);
      expect(logger.logger.debug).toHaveBeenCalledWith(
        'Invalid registries.my-reg.min-publish-age in cargo config: invalid',
      );
    });

    it('escapes the glob characters of a registry URL', () => {
      expect(
        getMinPublishAgeRules(
          {
            registry: { 'global-min-publish-age': '7 days' },
            registries: { ipv6: { 'min-publish-age': '0' } },
          },
          { ipv6: 'sparse+http://[::1]:8000/index/' },
        ),
      ).toEqual([
        { matchDatasources: ['crate'], minimumReleaseAgeExtracted: '7 days' },
        {
          matchDatasources: ['crate'],
          matchRegistryUrls: ['sparse+http://\\[::1\\]:8000/index/'],
          minimumReleaseAgeExtracted: null,
        },
      ]);
    });

    describe('with a registry which replaces crates.io', () => {
      const mirrorUrl = 'sparse+https://mirror.example.com/index/';

      it.each`
        mirrorAge    | rules
        ${'1 day'}   | ${[]}
        ${'7 days'}  | ${[]}
        ${'0'}       | ${[]}
        ${'14 days'} | ${[{ matchDatasources: ['crate'], matchRegistryUrls: [mirrorUrl], minimumReleaseAgeExtracted: '14 days' }]}
      `(
        'only adds a larger min-publish-age $mirrorAge of the registry to the age of crates.io',
        ({ mirrorAge, rules }) => {
          expect(
            getMinPublishAgeRules(
              {
                registry: { 'global-min-publish-age': '7 days' },
                registries: { mirror: { 'min-publish-age': mirrorAge } },
              },
              { mirror: mirrorUrl },
              mirrorUrl,
            ),
          ).toEqual([
            {
              matchDatasources: ['crate'],
              minimumReleaseAgeExtracted: '7 days',
            },
            ...rules,
          ]);
        },
      );
    });

    it('returns no rules without an age', () => {
      expect(getMinPublishAgeRules({}, urls)).toEqual([]);
    });
  });

  describe('getRegistryMinPublishAges()', () => {
    it('returns the min-publish-age of each registry', () => {
      expect(
        getRegistryMinPublishAges({
          registries: {
            'crates-io': { 'min-publish-age': '0' },
            private: { index: 'https://example.com', 'min-publish-age': '1d' },
            other: { index: 'https://other.example.com' },
          },
        }),
      ).toEqual({ 'crates-io': '0', private: '1d' });
    });

    it.each`
      registries
      ${undefined}
      ${{ other: { index: 'https://other.example.com' } }}
    `(
      'returns undefined without a min-publish-age in $registries',
      ({ registries }) => {
        expect(getRegistryMinPublishAges({ registries })).toBeUndefined();
      },
    );
  });

  describe('getMinPublishAgeEnv()', () => {
    function env(age: string): MinPublishAgeEnv {
      return {
        env: {
          CARGO_REGISTRY_GLOBAL_MIN_PUBLISH_AGE: age,
          CARGO_RESOLVER_INCOMPATIBLE_PUBLISH_AGE: 'deny',
        },
      };
    }

    const options = { manager: 'cargo', packageFile: 'Cargo.toml' };

    describe('without minimumReleaseAgePackageManagerSync', () => {
      const ages = {
        manager: 'cargo',
        minimumReleaseAge: '2 weeks',
        minimumReleaseAgeExtracted: '1 week',
        minimumReleaseAgePackageManager: '3 days',
        minimumReleaseAgeRepository: '3 days',
      };

      it('returns nothing for updates', async () => {
        await expect(
          getMinPublishAgeEnv({
            ...options,
            config: ages,
            upgrades: [
              {
                ...ages,
                datasource: CrateDatasource.id,
                depName: 'my-crate',
                minimumReleaseAge: null,
                releaseTimestamp: daysAgo(1),
              },
            ],
          }),
        ).resolves.toEqual({ env: {} });
        expect(fs.readLocalFile).not.toHaveBeenCalled();
      });

      it('returns nothing for lock file maintenance', async () => {
        await expect(
          getMinPublishAgeEnv({
            ...options,
            config: { ...ages, isLockFileMaintenance: true },
            upgrades: [],
          }),
        ).resolves.toEqual({ env: {} });
        expect(fs.readLocalFile).not.toHaveBeenCalled();
      });
    });

    it('uses minimumReleaseAgeRepository over packageRules', async () => {
      await expect(
        getMinPublishAgeEnv({
          ...options,
          config: { minimumReleaseAge: '2 weeks' },
          upgrades: [
            {
              manager: 'cargo',
              minimumReleaseAge: '2 weeks',
              minimumReleaseAgePackageManagerSync: true,
              minimumReleaseAgeRepository: '3 days',
            },
          ],
        }),
      ).resolves.toEqual(env('3 days'));
    });

    it.each`
      configAge    | expected
      ${'1 week'}  | ${{ env: {} }}
      ${'1 month'} | ${{ env: {} }}
      ${'1 day'}   | ${env('3 days')}
      ${'0'}       | ${env('3 days')}
      ${undefined} | ${env('3 days')}
    `(
      'leaves a larger global-min-publish-age of $configAge in the cargo config to cargo',
      async ({ configAge, expected }) => {
        fs.readLocalFile.mockResolvedValueOnce(
          configAge
            ? `[registry]\nglobal-min-publish-age = "${configAge}"\n`
            : null,
        );
        await expect(
          getMinPublishAgeEnv({
            ...options,
            config: {},
            upgrades: [
              {
                manager: 'cargo',
                minimumReleaseAgeExtracted: '14 days',
                minimumReleaseAgePackageManagerSync: true,
                minimumReleaseAgeRepository: '3 days',
              },
            ],
          }),
        ).resolves.toEqual(expected);
        expect(fs.readLocalFile).toHaveBeenCalledWith('.cargo/config', 'utf8');
      },
    );

    it('reads the cargo config from .cargo/config.toml without .cargo/config', async () => {
      fs.readLocalFile.mockResolvedValueOnce(null);
      fs.readLocalFile.mockResolvedValueOnce(codeBlock`
        [registry]
        global-min-publish-age = "1 week"
      `);

      await expect(
        getMinPublishAgeEnv({
          ...options,
          config: {},
          upgrades: [
            {
              manager: 'cargo',
              minimumReleaseAgePackageManagerSync: true,
              minimumReleaseAgeRepository: '2 weeks',
            },
          ],
        }),
      ).resolves.toEqual(env('14 days'));

      expect(fs.readLocalFile).toHaveBeenLastCalledWith(
        '.cargo/config.toml',
        'utf8',
      );
    });

    it.each`
      configAge    | expected
      ${'1 week'}  | ${env('7 days')}
      ${'1 day'}   | ${env('3 days')}
      ${undefined} | ${env('3 days')}
    `(
      'passes deny with the larger age if the cargo config sets allow with a global-min-publish-age of $configAge',
      async ({ configAge, expected }) => {
        fs.readLocalFile.mockResolvedValueOnce(
          `[resolver]\nincompatible-publish-age = "allow"\n${configAge ? `[registry]\nglobal-min-publish-age = "${configAge}"\n` : ''}`,
        );

        await expect(
          getMinPublishAgeEnv({
            ...options,
            config: {},
            upgrades: [
              {
                manager: 'cargo',
                minimumReleaseAgePackageManagerSync: true,
                minimumReleaseAgeRepository: '3 days',
              },
            ],
          }),
        ).resolves.toEqual(expected);
      },
    );

    it('uses the own age of lock file maintenance', async () => {
      await expect(
        getMinPublishAgeEnv({
          ...options,
          config: {
            isLockFileMaintenance: true,
            minimumReleaseAge: '36 hours',
            minimumReleaseAgePackageManagerSync: true,
            minimumReleaseAgeRepository: '3 days',
          },
          upgrades: [],
        }),
      ).resolves.toEqual(env('36 hours'));
    });

    it('returns nothing for security updates', async () => {
      await expect(
        getMinPublishAgeEnv({
          ...options,
          config: {},
          upgrades: [
            {
              manager: 'cargo',
              isVulnerabilityAlert: true,
              minimumReleaseAgeExtracted: '1 week',
              minimumReleaseAgePackageManagerSync: true,
              minimumReleaseAgeRepository: '3 days',
            },
          ],
        }),
      ).resolves.toEqual({ env: {} });
      expect(fs.readLocalFile).not.toHaveBeenCalled();
    });

    it('returns nothing without minimumReleaseAgeRepository', async () => {
      await expect(
        getMinPublishAgeEnv({
          ...options,
          config: {},
          upgrades: [
            {
              manager: 'cargo',
              minimumReleaseAgeExtracted: '1 week',
              minimumReleaseAgePackageManagerSync: true,
            },
          ],
        }),
      ).resolves.toEqual({ env: {} });
    });

    describe('crates with a smaller minimumReleaseAge', () => {
      const crate = {
        manager: 'cargo',
        datasource: CrateDatasource.id,
        depName: 'my-crate',
        minimumReleaseAge: null,
        minimumReleaseAgePackageManagerSync: true,
        minimumReleaseAgeRepository: '7 days',
      } satisfies Upgrade<CargoManagerData>;

      function run(
        upgrades: Upgrade<CargoManagerData>[],
        config = {},
      ): Promise<MinPublishAgeEnv> {
        return getMinPublishAgeEnv({ ...options, config, upgrades });
      }

      it.each`
        description            | releaseTimestamp
        ${'a younger release'} | ${daysAgo(1)}
        ${'no timestamp'}      | ${undefined}
      `(
        'lowers the age to the age of a crate with $description',
        async ({ releaseTimestamp }) => {
          await expect(run([{ ...crate, releaseTimestamp }])).resolves.toEqual({
            env: {},
            notice:
              'Cargo checked no publish age instead of 7 days for this update, because the `minimumReleaseAge` of `my-crate` is smaller.',
          });
          expect(logger.logger.debug).toHaveBeenCalledWith(
            'Cargo checks no publish age instead of 7 days, as the minimumReleaseAge of my-crate is smaller and their release is younger or has no timestamp',
          );
        },
      );

      it('lowers the age to the smallest age of the crates', async () => {
        await expect(
          run([
            { ...crate, minimumReleaseAge: '3 days' },
            { ...crate, depName: 'other-crate', minimumReleaseAge: '2 days' },
          ]),
        ).resolves.toEqual({
          ...env('2 days'),
          notice:
            'Cargo checked a publish age of 2 days instead of 7 days for this update, because the `minimumReleaseAge` of `my-crate`, `other-crate` is smaller.',
        });
      });

      it('lowers the age no further than global-min-publish-age', async () => {
        fs.readLocalFile.mockResolvedValueOnce(codeBlock`
          [registry]
          global-min-publish-age = "3 days"
        `);
        await expect(run([crate])).resolves.toEqual({
          env: {},
          notice:
            'Cargo checked a publish age of 3 days instead of 7 days for this update, because the `minimumReleaseAge` of `my-crate` is smaller.',
        });
      });

      it.each`
        registry       | managerData                    | age
        ${'private'}   | ${{ registryName: 'private' }} | ${'1 day'}
        ${'private'}   | ${{ registryName: 'private' }} | ${'0'}
        ${'crates-io'} | ${undefined}                   | ${'10 days'}
      `(
        'keeps the age for a crate of registry $registry with a min-publish-age of $age',
        async ({ registry, managerData, age }) => {
          fs.readLocalFile.mockResolvedValueOnce(
            `[registries.${registry}]\nmin-publish-age = "${age}"\n`,
          );
          await expect(run([{ ...crate, managerData }])).resolves.toEqual(
            env('7 days'),
          );
        },
      );

      it('lowers the age for a crate of a registry with an invalid min-publish-age', async () => {
        fs.readLocalFile.mockResolvedValueOnce(codeBlock`
          [registries.private]
          min-publish-age = "bananas"
        `);
        const { env: result } = await run([
          { ...crate, managerData: { registryName: 'private' } },
        ]);
        expect(result).toEqual({});
      });

      it('names every crate once', async () => {
        const { notice } = await run([
          crate,
          { ...crate, depType: 'dev-dependencies' },
          { ...crate, depName: 'other-crate', minimumReleaseAge: '1 day' },
        ]);
        expect(notice).toStartWith(
          'Cargo checked no publish age instead of 7 days for this update, because the `minimumReleaseAge` of `my-crate`, `other-crate` is smaller',
        );
      });

      it('lowers the age to the age of the crate without its buffer', async () => {
        await expect(
          run([
            {
              ...crate,
              minimumReleaseAge: '2 days',
              minimumReleaseAgeBuffer: '30 minutes',
            },
          ]),
        ).resolves.toEqual({
          ...env('2 days'),
          notice:
            'Cargo checked a publish age of 2 days instead of 7 days for this update, because the `minimumReleaseAge` of `my-crate` is smaller.',
        });
      });

      it('passes nothing if the crate has the age of the cargo config and a buffer', async () => {
        fs.readLocalFile.mockResolvedValueOnce(codeBlock`
          [registry]
          global-min-publish-age = "3 days"
        `);

        await expect(
          run([
            {
              ...crate,
              minimumReleaseAgeBuffer: '30 minutes',
              minimumReleaseAgeExtracted: '3 days',
            },
          ]),
        ).resolves.toEqual({
          env: {},
          notice:
            'Cargo checked a publish age of 3 days instead of 7 days for this update, because the `minimumReleaseAge` of `my-crate` is smaller.',
        });
      });

      it('passes deny with the lowered age if the cargo config sets allow', async () => {
        fs.readLocalFile.mockResolvedValueOnce(codeBlock`
          [registry]
          global-min-publish-age = "3 days"

          [resolver]
          incompatible-publish-age = "allow"
        `);

        await expect(run([crate])).resolves.toEqual({
          ...env('3 days'),
          notice:
            'Cargo checked a publish age of 3 days instead of 7 days for this update, because the `minimumReleaseAge` of `my-crate` is smaller.',
        });
      });

      it('compares with the age raised to global-min-publish-age', async () => {
        fs.readLocalFile.mockResolvedValueOnce(codeBlock`
          [registry]
          global-min-publish-age = "7 days"
        `);
        await expect(
          run([
            {
              ...crate,
              minimumReleaseAge: '6 days',
              minimumReleaseAgeBuffer: '1 day',
              minimumReleaseAgeRepository: '3 days',
            },
          ]),
        ).resolves.toEqual({ env: {} });
      });

      it('compares with the minimumReleaseAgeExtracted of the crate', async () => {
        await expect(
          run([
            {
              ...crate,
              minimumReleaseAge: '1 day',
              minimumReleaseAgeExtracted: '7 days',
            },
          ]),
        ).resolves.toEqual(env('7 days'));
      });

      it.each`
        description                     | upgrade
        ${'an older release'}           | ${{ ...crate, releaseTimestamp: daysAgo(8) }}
        ${'another manager'}            | ${{ ...crate, manager: 'npm' }}
        ${'another datasource'}         | ${{ ...crate, datasource: 'git-tags' }}
        ${'lock file maintenance'}      | ${{ ...crate, isLockFileMaintenance: true, minimumReleaseAge: '1 day', minimumReleaseAgePackageManager: '7 days' }}
        ${'the same minimumReleaseAge'} | ${{ ...crate, minimumReleaseAge: '7 days' }}
      `('keeps the check for $description', async ({ upgrade }) => {
        await expect(run([upgrade], crate)).resolves.toEqual(env('7 days'));
      });

      it('keeps the check for lock file maintenance without updates', async () => {
        await expect(
          run([], {
            isLockFileMaintenance: true,
            minimumReleaseAge: '7 days',
            minimumReleaseAgePackageManagerSync: true,
          }),
        ).resolves.toEqual(env('7 days'));
      });
    });
  });

  describe('enforcesMinimumReleaseAge()', () => {
    it.each`
      constraint              | expected
      ${'1.100.0'}            | ${true}
      ${'1.100'}              | ${true}
      ${'1.101.1'}            | ${true}
      ${'>=1.100'}            | ${false}
      ${'1.99.0'}             | ${false}
      ${'1.100.0-beta.1'}     | ${false}
      ${'stable'}             | ${false}
      ${'nightly-2026-11-01'} | ${false}
      ${'invalid'}            | ${false}
      ${undefined}            | ${false}
    `(
      'returns $expected for the configured Rust constraint $constraint',
      async ({ constraint, expected }) => {
        await expect(
          enforcesMinimumReleaseAge({ constraints: { rust: constraint } }),
        ).resolves.toBe(expected);
      },
    );

    it('returns false if the lock file has git sources', async () => {
      await expect(
        enforcesMinimumReleaseAge({
          constraints: { rust: '1.100.0' },
          managerData: { lockFileHasGitSources: true },
        }),
      ).resolves.toBe(false);

      expect(logger.logger.debug).toHaveBeenCalledWith(
        'Cargo does not enforce the minimum release age, as the lock file has packages from git repositories, which cargo updates without checking their age',
      );
    });

    it('uses the extracted Rust constraint', async () => {
      await expect(
        enforcesMinimumReleaseAge({ extractedConstraints: { rust: '1.100' } }),
      ).resolves.toBe(true);
    });

    describe('min-publish-age of registries', () => {
      function enforces(
        registryMinPublishAges: Record<string, string>,
        minimumReleaseAgePackageManager?: string,
      ): Promise<boolean> {
        return enforcesMinimumReleaseAge({
          constraints: { rust: '1.100.0' },
          isLockFileMaintenance: true,
          managerData: { registryMinPublishAges },
          minimumReleaseAge: '7 days',
          minimumReleaseAgePackageManager,
          minimumReleaseAgePackageManagerSync: true,
        });
      }

      it.each`
        age
        ${'7 days'}
        ${'1 week'}
        ${'14 days'}
      `('returns true for a min-publish-age of $age', async ({ age }) => {
        await expect(
          enforces({ 'crates-io': age, private: '2 weeks' }),
        ).resolves.toBe(true);
      });

      it('ignores a larger minimumReleaseAgePackageManager', async () => {
        await expect(
          enforces({ 'crates-io': '7 days' }, '14 days'),
        ).resolves.toBe(true);
      });

      it.each`
        age          | message
        ${'0'}       | ${'Cargo does not enforce the minimum release age, as the min-publish-age 0 of registry private turns the check off for that registry like allow, so Renovate does not rely on cargo'}
        ${'3 days'}  | ${'Cargo does not enforce the minimum release age, as the min-publish-age 3 days of registry private is smaller than the minimumReleaseAge of lock file maintenance, and takes precedence over the age which Renovate passes'}
        ${'invalid'} | ${'Cargo does not enforce the minimum release age, as registry private has an invalid min-publish-age invalid'}
        ${'7d'}      | ${'Cargo does not enforce the minimum release age, as registry private has an invalid min-publish-age 7d'}
      `(
        'returns false for a min-publish-age of $age',
        async ({ age, message }) => {
          await expect(
            enforces({ 'crates-io': '7 days', private: age }),
          ).resolves.toBe(false);
          expect(logger.logger.debug).toHaveBeenCalledWith(message);
        },
      );
    });

    it('prefers the configured Rust constraint', async () => {
      await expect(
        enforcesMinimumReleaseAge({
          constraints: { rust: '1.99.0' },
          extractedConstraints: { rust: '1.100.0' },
        }),
      ).resolves.toBe(false);
    });
  });
});
