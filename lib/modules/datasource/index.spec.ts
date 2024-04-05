import fs from 'fs-extra';
import { logger } from '../../../test/util';
import {
  EXTERNAL_HOST_ERROR,
  HOST_DISABLED,
} from '../../constants/error-messages';
import { ExternalHostError } from '../../types/errors/external-host-error';
import { loadModules } from '../../util/modules';
import datasources from './api';
import { getDefaultVersioning } from './common';
import { Datasource } from './datasource';
import type {
  DatasourceApi,
  DigestConfig,
  GetReleasesConfig,
  ReleaseResult,
} from './types';
import {
  getDatasourceList,
  getDatasources,
  getDigest,
  getPkgReleases,
  supportsDigests,
} from '.';

const datasource = 'dummy';
const packageName = 'package';

type RegistriesMock = Record<
  string,
  ReleaseResult | (() => ReleaseResult) | null
>;
const defaultRegistriesMock: RegistriesMock = {
  'https://reg1.com': { releases: [{ version: '1.2.3' }] },
};

class DummyDatasource extends Datasource {
  override defaultVersioning = 'python';
  override defaultRegistryUrls = ['https://reg1.com'];

  constructor(private registriesMock: RegistriesMock = defaultRegistriesMock) {
    super(datasource);
  }

  override getReleases({
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const fn = this.registriesMock[registryUrl!];
    if (typeof fn === 'function') {
      return Promise.resolve(fn());
    }
    return Promise.resolve(fn ?? null);
  }
}

class DummyDatasource2 extends Datasource {
  override defaultRegistryUrls = function () {
    return ['https://reg1.com'];
  };

  constructor(private registriesMock: RegistriesMock = defaultRegistriesMock) {
    super(datasource);
  }

  override getReleases({
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const fn = this.registriesMock[registryUrl!];
    if (typeof fn === 'function') {
      return Promise.resolve(fn());
    }
    return Promise.resolve(fn ?? null);
  }
}

class DummyDatasource3 extends Datasource {
  override customRegistrySupport = false;
  override defaultRegistryUrls = function () {
    return ['https://reg1.com'];
  };

  constructor(private registriesMock: RegistriesMock = defaultRegistriesMock) {
    super(datasource);
  }

  override getReleases({
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const fn = this.registriesMock[registryUrl!];
    if (typeof fn === 'function') {
      return Promise.resolve(fn());
    }
    return Promise.resolve(fn ?? null);
  }
}

class DummyDatasource4 extends DummyDatasource3 {
  override defaultRegistryUrls = undefined as never;
}

class DummyDatasource5 extends Datasource {
  override registryStrategy = undefined as never;

  constructor(private registriesMock: RegistriesMock = defaultRegistriesMock) {
    super(datasource);
  }

  override getReleases({
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const fn = this.registriesMock[registryUrl!];
    if (typeof fn === 'function') {
      return Promise.resolve(fn());
    }
    return Promise.resolve(fn ?? null);
  }
}

jest.mock('./metadata-manual', () => ({
  manualChangelogUrls: {
    dummy: {
      package: 'https://foo.bar/package/CHANGELOG.md',
    },
  },
  manualSourceUrls: {
    dummy: {
      package: 'https://foo.bar/package',
    },
  },
}));

describe('modules/datasource/index', () => {
  afterEach(() => {
    datasources.delete(datasource);
  });

  describe('getDefaultVersioning()', () => {
    it('returns semver if undefined', () => {
      expect(getDefaultVersioning(undefined)).toBe('semver-coerced');
    });
  });

  describe('Validations', () => {
    it('returns datasources', () => {
      expect(getDatasources()).toBeDefined();

      const managerList = fs
        .readdirSync(__dirname, { withFileTypes: true })
        .filter(
          (dirent) => dirent.isDirectory() && !dirent.name.startsWith('_'),
        )
        .map((dirent) => dirent.name)
        .sort();
      expect(getDatasourceList()).toEqual(managerList);
    });

    it('validates datasource', () => {
      function validateDatasource(
        module: DatasourceApi,
        name: string,
      ): boolean {
        if (!module.getReleases) {
          return false;
        }
        return module.id === name;
      }

      function filterClassBasedDatasources(name: string): boolean {
        return !(getDatasources().get(name) instanceof Datasource);
      }

      const dss = new Map(getDatasources());

      for (const ds of dss.values()) {
        if (ds instanceof Datasource) {
          dss.delete(ds.id);
        }
      }

      const loadedDs = loadModules(
        __dirname,
        validateDatasource,
        filterClassBasedDatasources,
      );
      expect(Array.from(dss.keys())).toEqual(Object.keys(loadedDs));

      for (const dsName of dss.keys()) {
        const ds = dss.get(dsName)!;
        expect(validateDatasource(ds, dsName)).toBeTrue();
      }
    });

    it('returns null for null datasource', async () => {
      expect(
        await getPkgReleases({
          datasource: null as never, // #22198
          packageName: 'some/dep',
        }),
      ).toBeNull();
    });

    it('returns null for no packageName', async () => {
      datasources.set(datasource, new DummyDatasource());
      expect(
        await getPkgReleases({
          datasource,
          packageName: null as never, // #22198
        }),
      ).toBeNull();
    });

    it('returns null for unknown datasource', async () => {
      expect(
        await getPkgReleases({
          datasource: 'some-unknown-datasource',
          packageName: 'some/dep',
        }),
      ).toBeNull();
    });

    it('ignores and warns for disabled custom registryUrls', async () => {
      class TestDatasource extends DummyDatasource {
        override readonly customRegistrySupport = false;
      }
      datasources.set(datasource, new TestDatasource());
      const registryUrls = ['https://foo.bar'];

      const res = await getPkgReleases({
        datasource,
        packageName,
        registryUrls,
      });

      expect(logger.logger.warn).toHaveBeenCalledWith(
        { datasource: 'dummy', registryUrls, defaultRegistryUrls: undefined },
        'Custom registries are not allowed for this datasource and will be ignored',
      );
      expect(res).toMatchObject({ releases: [{ version: '1.2.3' }] });
    });
  });

  describe('Digest', () => {
    it('returns if digests are supported', () => {
      datasources.set(datasource, new DummyDatasource());
      expect(supportsDigests(datasource)).toBeFalse();
    });

    it('returns value if defined', async () => {
      class TestDatasource extends DummyDatasource {
        override getDigest(): Promise<string> {
          return Promise.resolve('123');
        }
      }
      datasources.set(datasource, new TestDatasource());

      expect(supportsDigests(datasource)).toBeTrue();
      expect(await getDigest({ datasource, packageName })).toBe('123');
    });

    it('returns replacementName if defined', async () => {
      class TestDatasource extends DummyDatasource {
        override getDigest(
          config: DigestConfig,
          newValue?: string,
        ): Promise<string> {
          return Promise.resolve(config.packageName);
        }
      }
      datasources.set(datasource, new TestDatasource());

      expect(
        await getDigest({
          datasource,
          packageName: 'pkgName',
          replacementName: 'replacement',
        }),
      ).toBe('replacement');
    });
  });

  describe('Metadata', () => {
    beforeEach(() => {
      datasources.set(datasource, new DummyDatasource());
    });

    it('adds changelogUrl', async () => {
      expect(await getPkgReleases({ datasource, packageName })).toMatchObject({
        changelogUrl: 'https://foo.bar/package/CHANGELOG.md',
      });
    });

    it('adds sourceUrl', async () => {
      expect(await getPkgReleases({ datasource, packageName })).toMatchObject({
        sourceUrl: 'https://foo.bar/package',
      });
    });
  });

  describe('Packages', () => {
    it('supports defaultRegistryUrls parameter', async () => {
      const registries: RegistriesMock = {
        'https://foo.bar': { releases: [{ version: '0.0.1' }] },
      };
      datasources.set(datasource, new DummyDatasource(registries));

      const res = await getPkgReleases({
        datasource,
        packageName,
        defaultRegistryUrls: ['https://foo.bar'],
      });
      expect(res).toMatchObject({ releases: [{ version: '0.0.1' }] });
    });

    it('defaultRegistryUrls function works', async () => {
      datasources.set(datasource, new DummyDatasource2());
      const res = await getPkgReleases({
        datasource,
        packageName,
      });
      expect(res).toMatchObject({
        releases: [{ version: '1.2.3' }],
        registryUrl: 'https://reg1.com',
      });
    });

    it('defaultRegistryUrls function with customRegistrySupport works', async () => {
      datasources.set(datasource, new DummyDatasource3());
      const res = await getPkgReleases({
        datasource,
        packageName,
      });
      expect(res).toMatchObject({
        releases: [{ version: '1.2.3' }],
        registryUrl: 'https://reg1.com',
      });
    });

    // for coverage
    it('undefined defaultRegistryUrls with customRegistrySupport works', async () => {
      datasources.set(datasource, new DummyDatasource4());
      const res = await getPkgReleases({
        datasource,
        packageName,
      });
      expect(res).toBeNull();
    });

    it('applies extractVersion', async () => {
      const registries: RegistriesMock = {
        'https://reg1.com': {
          releases: [{ version: 'v4.3.143' }, { version: 'rc4.3.143' }],
        },
      };
      datasources.set(datasource, new DummyDatasource(registries));

      const res = await getPkgReleases({
        datasource,
        packageName,
        extractVersion: '^(?<version>v\\d+\\.\\d+)',
        versioning: 'loose',
      });
      expect(res).toMatchObject({ releases: [{ version: 'v4.3' }] });
    });

    it('trims sourceUrl', async () => {
      datasources.set(
        datasource,
        new DummyDatasource({
          'https://reg1.com': {
            sourceUrl: '   https://abc.com   ',
            releases: [{ version: '1.0.0' }],
          },
        }),
      );
      const res = await getPkgReleases({
        datasource,
        packageName: 'foobar',
      });
      expect(res).toMatchObject({ sourceUrl: 'https://abc.com' });
    });

    it('massages sourceUrl', async () => {
      datasources.set(
        datasource,
        new DummyDatasource({
          'https://reg1.com': {
            sourceUrl: 'scm:git@github.com:Jasig/cas.git',
            releases: [{ version: '1.0.0' }],
          },
        }),
      );
      const res = await getPkgReleases({
        datasource,
        packageName: 'foobar',
      });
      expect(res).toMatchObject({ sourceUrl: 'https://github.com/Jasig/cas' });
    });

    it('applies replacements', async () => {
      datasources.set(datasource, new DummyDatasource());
      const res = await getPkgReleases({
        datasource,
        packageName,
        replacementName: 'def',
        replacementVersion: '2.0.0',
      });
      expect(res).toMatchObject({
        replacementName: 'def',
        replacementVersion: '2.0.0',
      });
    });

    describe('Registry strategies', () => {
      describe('first', () => {
        class FirstRegistryDatasource extends DummyDatasource {
          override readonly registryStrategy = 'first';
        }

        it('returns value from single registry', async () => {
          datasources.set(datasource, new FirstRegistryDatasource());

          const res = await getPkgReleases({
            datasource,
            packageName,
            registryUrls: ['https://reg1.com'],
          });

          expect(res).toMatchObject({
            releases: [{ version: '1.2.3' }],
            registryUrl: 'https://reg1.com',
          });
          expect(logger.logger.warn).not.toHaveBeenCalled();
        });

        it('warns and returns first result', async () => {
          const registries: RegistriesMock = {
            'https://reg1.com': { releases: [{ version: '1.0.0' }] },
            'https://reg2.com': { releases: [{ version: '2.0.0' }] },
            'https://reg3.com': null,
          };
          const registryUrls = Object.keys(registries);
          datasources.set(datasource, new FirstRegistryDatasource(registries));

          const res = await getPkgReleases({
            datasource,
            packageName,
            registryUrls,
          });

          expect(res).toMatchObject({
            releases: [{ version: '1.0.0' }],
            registryUrl: 'https://reg1.com',
          });
          expect(logger.logger.warn).toHaveBeenCalledWith(
            {
              datasource: 'dummy',
              packageName: 'package',
              registryUrls,
            },
            'Excess registryUrls found for datasource lookup - using first configured only',
          );
        });

        it('warns and returns first null', async () => {
          const registries: RegistriesMock = {
            'https://reg1.com': null,
            'https://reg2.com': { releases: [{ version: '1.2.3' }] },
          };
          const registryUrls = Object.keys(registries);
          datasources.set(datasource, new FirstRegistryDatasource(registries));

          const res = await getPkgReleases({
            datasource,
            packageName,
            registryUrls,
          });

          expect(res).toBeNull();
          expect(logger.logger.warn).toHaveBeenCalledWith(
            { datasource, packageName, registryUrls },
            'Excess registryUrls found for datasource lookup - using first configured only',
          );
        });
      });

      describe('merge', () => {
        class MergeRegistriesDatasource extends DummyDatasource {
          override readonly registryStrategy = 'merge';
          override caching = true;
          override readonly defaultRegistryUrls = [
            'https://reg1.com',
            'https://reg2.com',
          ];
        }

        const registries: RegistriesMock = {
          'https://reg1.com': () => ({ releases: [{ version: '1.0.0' }] }),
          'https://reg2.com': () => ({ releases: [{ version: '1.1.0' }] }),
          'https://reg3.com': () => {
            throw new ExternalHostError(new Error());
          },
          'https://reg4.com': () => {
            throw new Error('a');
          },
          'https://reg5.com': () => {
            throw new Error('b');
          },
          // for coverage
          'https://reg6.com': null,
          // has the same result as reg1 url, to test de-deplication of releases
          'https://reg7.com': () => ({ releases: [{ version: '1.0.0' }] }),
        };

        beforeEach(() => {
          datasources.set(
            datasource,
            new MergeRegistriesDatasource(registries),
          );
        });

        it('merges custom defaultRegistryUrls and returns success', async () => {
          const res = await getPkgReleases({ datasource, packageName });

          expect(res).toMatchObject({
            releases: [
              { registryUrl: 'https://reg1.com', version: '1.0.0' },
              { registryUrl: 'https://reg2.com', version: '1.1.0' },
            ],
          });
        });

        it('ignores custom defaultRegistryUrls if registryUrls are set', async () => {
          const res = await getPkgReleases({
            datasource,
            packageName,
            defaultRegistryUrls: ['https://reg3.com'],
            registryUrls: ['https://reg1.com', 'https://reg2.com'],
          });

          expect(res).toMatchObject({
            releases: [
              { registryUrl: 'https://reg1.com', version: '1.0.0' },
              { registryUrl: 'https://reg2.com', version: '1.1.0' },
            ],
          });
        });

        it('merges registries and returns success', async () => {
          const res = await getPkgReleases({
            datasource,
            packageName,
            registryUrls: ['https://reg1.com', 'https://reg2.com'],
          });
          expect(res).toMatchObject({
            releases: [
              { registryUrl: 'https://reg1.com', version: '1.0.0' },
              { registryUrl: 'https://reg2.com', version: '1.1.0' },
            ],
          });
        });

        it('filters out duplicate releases', async () => {
          const res = await getPkgReleases({
            datasource,
            packageName,
            registryUrls: ['https://reg1.com', 'https://reg7.com'],
          });
          expect(res).toMatchObject({
            releases: [
              { registryUrl: 'https://reg1.com', version: '1.0.0' },
              // { registryUrl: 'https://reg2.com', version: '1.0.0' },
            ],
          });
        });

        it('merges registries and aborts on ExternalHostError', async () => {
          await expect(
            getPkgReleases({
              datasource,
              packageName,
              registryUrls: [
                'https://reg1.com',
                'https://reg2.com',
                'https://reg3.com',
              ],
            }),
          ).rejects.toThrow(EXTERNAL_HOST_ERROR);
        });

        it('merges registries and returns null for error', async () => {
          expect(
            await getPkgReleases({
              datasource,
              packageName,
              registryUrls: ['https://reg4.com', 'https://reg5.com'],
            }),
          ).toBeNull();
        });
      });

      describe('hunt', () => {
        class HuntRegistriyDatasource extends DummyDatasource {
          override readonly registryStrategy = 'hunt';
        }

        it('returns first successful result', async () => {
          const registries: RegistriesMock = {
            'https://reg1.com': null,
            'https://reg2.com': () => {
              throw new Error('unknown');
            },
            'https://reg3.com': { releases: [{ version: '1.0.0' }] },
            'https://reg4.com': { releases: [{ version: '2.0.0' }] },
            'https://reg5.com': { releases: [{ version: '3.0.0' }] },
          };
          const registryUrls = Object.keys(registries);
          datasources.set(datasource, new HuntRegistriyDatasource(registries));

          const res = await getPkgReleases({
            datasource,
            packageName,
            registryUrls,
          });

          expect(res).toMatchObject({
            registryUrl: 'https://reg3.com',
            releases: [{ version: '1.0.0' }],
          });
        });

        it('returns null for HOST_DISABLED', async () => {
          const registries: RegistriesMock = {
            'https://reg1.com': () => {
              throw new ExternalHostError(new Error(HOST_DISABLED));
            },
            'https://reg2.com': { releases: [{ version: '1.0.0' }] },
          };
          const registryUrls = Object.keys(registries);
          datasources.set(datasource, new HuntRegistriyDatasource(registries));

          const res = await getPkgReleases({
            datasource,
            packageName,
            registryUrls,
          });

          expect(res).toBeNull();
        });

        it('aborts on ExternalHostError', async () => {
          const registries: RegistriesMock = {
            'https://reg1.com': () => {
              throw new ExternalHostError(new Error('something unknown'));
            },
            'https://reg2.com': { releases: [{ version: '1.0.0' }] },
          };
          const registryUrls = Object.keys(registries);
          datasources.set(datasource, new HuntRegistriyDatasource(registries));

          await expect(
            getPkgReleases({ datasource, packageName, registryUrls }),
          ).rejects.toThrow(EXTERNAL_HOST_ERROR);
        });

        it('returns null if no releases are found', async () => {
          const registries: RegistriesMock = {
            'https://reg1.com': () => {
              throw { statusCode: '404' };
            },
            'https://reg2.com': () => {
              throw { statusCode: '401' };
            },
            'https://reg3.com': () => {
              throw { statusCode: '403' };
            },
            'https://reg4.com': () => {
              throw new Error('b');
            },
            'https://reg5.com': () => {
              throw { code: '403' };
            },
          };
          const registryUrls = Object.keys(registries);
          datasources.set(datasource, new HuntRegistriyDatasource(registries));

          const res = await getPkgReleases({
            datasource,
            packageName,
            registryUrls,
          });

          expect(res).toBeNull();
        });

        it('defaults to hunt strategy', async () => {
          const registries: RegistriesMock = {
            'https://reg1.com': null,
            'https://reg2.com': () => {
              throw new Error('unknown');
            },
            'https://reg3.com': { releases: [{ version: '1.0.0' }] },
            'https://reg4.com': { releases: [{ version: '2.0.0' }] },
            'https://reg5.com': { releases: [{ version: '3.0.0' }] },
          };
          const registryUrls = Object.keys(registries);
          datasources.set(datasource, new DummyDatasource5(registries));

          const res = await getPkgReleases({
            datasource,
            packageName,
            registryUrls,
          });

          expect(res).toMatchObject({
            registryUrl: 'https://reg3.com',
            releases: [{ version: '1.0.0' }],
          });
        });
      });

      describe('relaseConstraintFiltering', () => {
        it('keeps all releases by default', async () => {
          const registries = {
            'https://foo.bar': {
              releases: [
                {
                  version: '0.0.1',
                  constraints: {
                    python: ['2.7'],
                  },
                },
                {
                  version: '0.0.2',
                },
              ],
            },
          } satisfies RegistriesMock;
          datasources.set(datasource, new DummyDatasource(registries));
          const res = await getPkgReleases({
            datasource,
            packageName,
            defaultRegistryUrls: ['https://foo.bar'],
          });
          expect(res).toMatchObject({
            releases: [{ version: '0.0.1' }, { version: '0.0.2' }],
          });
        });

        it('keeps all releases if constraints is set but no value defined for constraintsFiltering', async () => {
          const registries = {
            'https://foo.bar': {
              releases: [
                {
                  version: '0.0.1',
                  constraints: {
                    python: ['2.7'],
                  },
                },
                {
                  version: '0.0.2',
                },
              ],
            },
          } satisfies RegistriesMock;
          datasources.set(datasource, new DummyDatasource(registries));
          const res = await getPkgReleases({
            datasource,
            packageName,
            defaultRegistryUrls: ['https://foo.bar'],
            constraints: {
              python: '2.7.0',
            },
          });
          expect(res).toMatchObject({
            releases: [{ version: '0.0.1' }, { version: '0.0.2' }],
          });
        });

        it('filters releases if value is strict', async () => {
          const registries = {
            'https://foo.bar': {
              releases: [
                {
                  version: '0.0.5',
                  constraints: {
                    python: ['>= 3.0.0, < 4.0'],
                  },
                },
                {
                  version: '0.0.4',
                  constraints: {
                    python: ['>= 2.7, < 4.0'],
                  },
                },
                {
                  version: '0.0.3',
                  constraints: {
                    python: ['>= 2.7, < 3.0'],
                  },
                },
                {
                  version: '0.0.2',
                  constraints: {
                    python: ['2.7'],
                  },
                },
                {
                  version: '0.0.1',
                  constraints: {
                    python: ['1.0'],
                  },
                },
              ],
            },
          } satisfies RegistriesMock;
          datasources.set(datasource, new DummyDatasource(registries));
          const res = await getPkgReleases({
            datasource,
            packageName,
            defaultRegistryUrls: ['https://foo.bar'],
            constraints: { python: '>= 2.7, < 3.0' },
            constraintsFiltering: 'strict',
          });
          expect(res).toMatchObject({
            releases: [{ version: '0.0.3' }, { version: '0.0.4' }],
          });
        });
      });
    });
  });
});
