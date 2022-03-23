import fs from 'fs-extra';
import { logger } from '../../../test/util';
import {
  EXTERNAL_HOST_ERROR,
  HOST_DISABLED,
} from '../../constants/error-messages';
import { ExternalHostError } from '../../types/errors/external-host-error';
import { loadModules } from '../../util/modules';
import datasources from './api';
import { Datasource } from './datasource';
import type { DatasourceApi, GetReleasesConfig, ReleaseResult } from './types';
import {
  getDatasourceList,
  getDatasources,
  getDigest,
  getPkgReleases,
  supportsDigests,
} from '.';

const datasource = 'dummy';
const depName = 'package';

type RegistriesMock = Record<string, ReleaseResult | (() => ReleaseResult)>;
const defaultRegistriesMock: RegistriesMock = {
  'https://reg1.com': { releases: [{ version: '1.2.3' }] },
};

class DummyDatasource extends Datasource {
  override defaultRegistryUrls = ['https://reg1.com'];

  constructor(private registriesMock: RegistriesMock = defaultRegistriesMock) {
    super(datasource);
  }

  override getReleases({
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const fn = this.registriesMock[registryUrl];
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
  beforeEach(() => {
    jest.resetAllMocks();
  });

  afterEach(() => {
    datasources.delete(datasource);
  });

  describe('Validations', () => {
    it('returns datasources', () => {
      expect(getDatasources()).toBeDefined();

      const managerList = fs
        .readdirSync(__dirname, { withFileTypes: true })
        .filter(
          (dirent) => dirent.isDirectory() && !dirent.name.startsWith('_')
        )
        .map((dirent) => dirent.name)
        .sort();
      expect(getDatasourceList()).toEqual(managerList);
    });

    it('validates datasource', () => {
      function validateDatasource(
        module: DatasourceApi,
        name: string
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
        filterClassBasedDatasources
      );
      expect(Array.from(dss.keys())).toEqual(Object.keys(loadedDs));

      for (const dsName of dss.keys()) {
        const ds = dss.get(dsName);
        expect(validateDatasource(ds, dsName)).toBeTrue();
      }
    });

    it('returns null for null datasource', async () => {
      expect(
        await getPkgReleases({
          datasource: null,
          depName: 'some/dep',
        })
      ).toBeNull();
    });

    it('returns null for no depName', async () => {
      datasources.set(datasource, new DummyDatasource());
      expect(
        await getPkgReleases({
          datasource: datasource,
          depName: null,
        })
      ).toBeNull();
    });

    it('returns null for unknown datasource', async () => {
      expect(
        await getPkgReleases({
          datasource: 'some-unknown-datasource',
          depName: 'some/dep',
        })
      ).toBeNull();
    });

    it('ignores and warns for disabled custom registryUrls', async () => {
      class TestDatasource extends DummyDatasource {
        override readonly customRegistrySupport = false;
      }
      datasources.set(datasource, new TestDatasource());
      const registryUrls = ['https://foo.bar'];

      const res = await getPkgReleases({ datasource, depName, registryUrls });

      expect(logger.logger.warn).toHaveBeenCalledWith(
        { datasource: 'dummy', registryUrls, defaultRegistryUrls: undefined },
        'Custom registries are not allowed for this datasource and will be ignored'
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
      expect(await getDigest({ datasource, depName })).toBe('123');
    });
  });

  describe('Metadata', () => {
    beforeEach(() => {
      datasources.set(datasource, new DummyDatasource());
    });

    it('adds changelogUrl', async () => {
      expect(await getPkgReleases({ datasource, depName })).toMatchObject({
        changelogUrl: 'https://foo.bar/package/CHANGELOG.md',
      });
    });

    it('adds sourceUrl', async () => {
      expect(await getPkgReleases({ datasource, depName })).toMatchObject({
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
        depName,
        defaultRegistryUrls: ['https://foo.bar'],
      });
      expect(res).toMatchObject({ releases: [{ version: '0.0.1' }] });
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
        depName,
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
        })
      );
      const res = await getPkgReleases({
        datasource,
        depName: 'foobar',
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
        })
      );
      const res = await getPkgReleases({
        datasource,
        depName: 'foobar',
      });
      expect(res).toMatchObject({ sourceUrl: 'https://github.com/Jasig/cas' });
    });

    it('applies replacements', async () => {
      datasources.set(datasource, new DummyDatasource());
      const res = await getPkgReleases({
        datasource,
        depName,
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
            depName,
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
            depName,
            registryUrls,
          });

          expect(res).toMatchObject({
            releases: [{ version: '1.0.0' }],
            registryUrl: 'https://reg1.com',
          });
          expect(logger.logger.warn).toHaveBeenCalledWith(
            {
              datasource: 'dummy',
              depName: 'package',
              registryUrls,
            },
            'Excess registryUrls found for datasource lookup - using first configured only'
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
            depName,
            registryUrls,
          });

          expect(res).toBeNull();
          expect(logger.logger.warn).toHaveBeenCalledWith(
            { datasource, depName, registryUrls },
            'Excess registryUrls found for datasource lookup - using first configured only'
          );
        });
      });

      describe('merge', () => {
        class MergeRegistriesDatasource extends DummyDatasource {
          override readonly registryStrategy = 'merge';
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
        };

        beforeEach(() => {
          datasources.set(
            datasource,
            new MergeRegistriesDatasource(registries)
          );
        });

        it('merges custom defaultRegistryUrls and returns success', async () => {
          const res = await getPkgReleases({ datasource, depName });

          expect(res).toMatchObject({
            releases: [
              { registryUrl: 'https://reg1.com', version: '1.0.0' },
              { registryUrl: 'https://reg2.com', version: '1.1.0' },
            ],
          });
        });

        it('ignores custom defaultRegistryUrls if registrUrls are set', async () => {
          const res = await getPkgReleases({
            datasource,
            depName,
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
            depName,
            registryUrls: ['https://reg1.com', 'https://reg2.com'],
          });
          expect(res).toMatchObject({
            releases: [
              { registryUrl: 'https://reg1.com', version: '1.0.0' },
              { registryUrl: 'https://reg2.com', version: '1.1.0' },
            ],
          });
        });

        it('merges registries and aborts on ExternalHostError', async () => {
          await expect(
            getPkgReleases({
              datasource,
              depName,
              registryUrls: [
                'https://reg1.com',
                'https://reg2.com',
                'https://reg3.com',
              ],
            })
          ).rejects.toThrow(EXTERNAL_HOST_ERROR);
        });

        it('merges registries and returns null for error', async () => {
          expect(
            await getPkgReleases({
              datasource,
              depName,
              registryUrls: ['https://reg4.com', 'https://reg5.com'],
            })
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
            depName,
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
            depName,
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
            getPkgReleases({ datasource, depName, registryUrls })
          ).rejects.toThrow(EXTERNAL_HOST_ERROR);
        });

        it('returns null if no releases are found', async () => {
          const registries: RegistriesMock = {
            'https://reg1.com': () => {
              throw new Error('a');
            },
            'https://reg2.com': () => {
              throw new Error('b');
            },
          };
          const registryUrls = Object.keys(registries);
          datasources.set(datasource, new HuntRegistriyDatasource(registries));

          const res = await getPkgReleases({
            datasource,
            depName,
            registryUrls,
          });

          expect(res).toBeNull();
        });
      });
    });
  });
});
