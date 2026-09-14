import type { RenovateConfig } from '~test/util.ts';
import { partial } from '~test/util.ts';
import { getConfig } from '../../../config/defaults.ts';
import { MavenDatasource } from '../../../modules/datasource/maven/index.ts';
import type { PackageFile } from '../../../modules/manager/types.ts';
import { ExternalHostError } from '../../../types/errors/external-host-error.ts';
import { Result } from '../../../util/result.ts';
import { fetchUpdates } from './fetch.ts';
import * as lookup from './lookup/index.ts';
import type { UpdateResult } from './lookup/types.ts';

const lookupUpdates = vi.mocked(lookup).lookupUpdates;

vi.mock('./lookup/index.ts');

describe('workers/repository/process/fetch', () => {
  describe('fetchUpdates()', () => {
    let config: RenovateConfig;

    beforeEach(() => {
      config = getConfig();
    });

    it('handles empty deps', async () => {
      const packageFiles: Record<string, PackageFile[]> = {
        npm: [{ packageFile: 'package.json', deps: [] }],
      };
      await fetchUpdates(config, packageFiles);
      expect(packageFiles).toEqual({
        npm: [{ deps: [], packageFile: 'package.json' }],
      });
    });

    it('handles ignored, skipped and disabled', async () => {
      config.ignoreDeps = ['abcd'];
      config.packageRules = [
        {
          matchPackageNames: ['foo'],
          enabled: false,
        },
      ];
      const packageFiles: Record<string, PackageFile[]> = {
        npm: [
          {
            packageFile: 'package.json',
            deps: [
              { depName: 'abcd' },
              { depName: 'foo' },
              { depName: 'skipped', skipReason: 'some-reason' as never },
            ],
          },
        ],
      };
      await fetchUpdates(config, packageFiles);
      expect(packageFiles).toEqual({
        npm: [
          {
            deps: [
              {
                depName: 'abcd',
                packageName: 'abcd',
                skipReason: 'ignored',
                updates: [],
              },
              {
                depName: 'foo',
                packageName: 'foo',
                skipReason: 'disabled',
                updates: [],
              },
              {
                depName: 'skipped',
                packageName: 'skipped',
                skipReason: 'some-reason',
                updates: [],
              },
            ],
            packageFile: 'package.json',
          },
        ],
      });
      expect(packageFiles.npm[0].deps[0].skipReason).toBe('ignored');
      expect(packageFiles.npm[0].deps[0].updates).toHaveLength(0);
      expect(packageFiles.npm[0].deps[1].skipReason).toBe('disabled');
      expect(packageFiles.npm[0].deps[1].updates).toHaveLength(0);
    });

    it('keeps skipping an unknown-registry dep which config gives no registry', async () => {
      const packageFiles: Record<string, PackageFile[]> = {
        dockerfile: [
          {
            packageFile: 'Dockerfile',
            deps: [
              {
                depName: 'bash',
                datasource: 'apk',
                skipReason: 'unknown-registry',
                skipStage: 'extract',
              },
            ],
          },
        ],
      };
      await fetchUpdates(config, packageFiles);
      expect(packageFiles.dockerfile[0].deps[0]).toMatchObject({
        skipReason: 'unknown-registry',
        skipStage: 'extract',
      });
      expect(lookupUpdates).not.toHaveBeenCalled();
    });

    it('keeps skipping an unknown-registry dep which only a rule enables', async () => {
      // the rule says the dependency is wanted, but names no registry to look
      // it up in, so there is still nothing Renovate can do with it
      config.packageRules = [{ matchDatasources: ['apk'], enabled: true }];
      const packageFiles: Record<string, PackageFile[]> = {
        dockerfile: [
          {
            packageFile: 'Dockerfile',
            deps: [
              {
                depName: 'bash',
                datasource: 'apk',
                skipReason: 'unknown-registry',
                skipStage: 'extract',
              },
            ],
          },
        ],
      };
      await fetchUpdates(config, packageFiles);
      expect(packageFiles.dockerfile[0].deps[0]).toMatchObject({
        skipReason: 'unknown-registry',
        skipStage: 'extract',
      });
      expect(lookupUpdates).not.toHaveBeenCalled();
    });

    it('looks up an unknown-registry dep which config gives a registry', async () => {
      lookupUpdates.mockResolvedValue(
        Result.ok(partial<UpdateResult>({ updates: [] })),
      );
      config.packageRules = [
        {
          matchDatasources: ['apk'],
          registryUrls: ['https://dl-cdn.alpinelinux.org/alpine?arch=x86_64'],
        },
      ];
      const packageFiles: Record<string, PackageFile[]> = {
        dockerfile: [
          {
            packageFile: 'Dockerfile',
            deps: [
              {
                depName: 'bash',
                datasource: 'apk',
                skipReason: 'unknown-registry',
                skipStage: 'extract',
              },
            ],
          },
        ],
      };
      await fetchUpdates(config, packageFiles);
      expect(packageFiles.dockerfile[0].deps[0]).not.toHaveProperty(
        'skipReason',
      );
      expect(packageFiles.dockerfile[0].deps[0]).not.toHaveProperty(
        'skipStage',
      );
      expect(lookupUpdates).toHaveBeenCalledWith(
        expect.objectContaining({
          registryUrls: ['https://dl-cdn.alpinelinux.org/alpine?arch=x86_64'],
        }),
      );
    });

    it('looks up an unknown-registry dep which config gives a default registry', async () => {
      lookupUpdates.mockResolvedValue(
        Result.ok(partial<UpdateResult>({ updates: [] })),
      );
      config.defaultRegistryUrls = [
        'https://dl-cdn.alpinelinux.org/alpine?arch=x86_64',
      ];
      const packageFiles: Record<string, PackageFile[]> = {
        dockerfile: [
          {
            packageFile: 'Dockerfile',
            deps: [
              {
                depName: 'bash',
                datasource: 'apk',
                skipReason: 'unknown-registry',
              },
            ],
          },
        ],
      };
      await fetchUpdates(config, packageFiles);
      expect(packageFiles.dockerfile[0].deps[0]).not.toHaveProperty(
        'skipReason',
      );
      expect(lookupUpdates).toHaveBeenCalledOnce();
    });

    it('keeps skipping an unknown-registry dep which brought its own registry', async () => {
      config.packageRules = [
        {
          matchDatasources: ['git-refs'],
          registryUrls: ['https://example.com'],
        },
      ];
      const packageFiles: Record<string, PackageFile[]> = {
        'pre-commit': [
          {
            packageFile: '.pre-commit-config.yaml',
            deps: [
              {
                depName: 'some/repo',
                datasource: 'git-refs',
                skipReason: 'unknown-registry',
                registryUrls: ['https://unknown-host.com'],
              },
            ],
          },
        ],
      };
      await fetchUpdates(config, packageFiles);
      expect(packageFiles['pre-commit'][0].deps[0]).toMatchObject({
        skipReason: 'unknown-registry',
      });
      expect(lookupUpdates).not.toHaveBeenCalled();
    });

    it('fetches updates', async () => {
      config.rangeStrategy = 'auto';
      // @ts-expect-error -- intentionally using invalid constraint names
      config.constraints = { some: 'different' };
      const packageFiles: any = {
        maven: [
          {
            packageFile: 'pom.xml',
            extractedConstraints: { some: 'constraint', other: 'constraint' },
            deps: [{ datasource: MavenDatasource.id, depName: 'bbb' }],
          },
        ],
      };
      lookupUpdates.mockResolvedValue(
        Result.ok(partial<UpdateResult>({ updates: ['a', 'b'] as never })),
      );
      await fetchUpdates(config, packageFiles);
      expect(packageFiles).toEqual({
        maven: [
          {
            deps: [
              {
                datasource: 'maven',
                depName: 'bbb',
                packageName: 'bbb',
                updates: ['a', 'b'],
              },
            ],
            extractedConstraints: { other: 'constraint', some: 'constraint' },
            packageFile: 'pom.xml',
          },
        ],
      });
    });

    describe('constraintsVersioning', () => {
      it('is merged from packageFile with config', async () => {
        config.constraintsVersioning = { gomodMod: 'config-version' };
        const packageFiles: any = {
          maven: [
            {
              packageFile: 'pom.xml',
              constraintsVersioning: {
                gomodMod: 'pfile-version',
                go: 'go-version',
              },
              deps: [{ datasource: MavenDatasource.id, depName: 'bbb' }],
            },
          ],
        };
        lookupUpdates.mockResolvedValue(
          Result.ok(partial<UpdateResult>({ updates: [] })),
        );

        await fetchUpdates(config, packageFiles);

        expect(lookupUpdates).toHaveBeenCalledWith(
          expect.objectContaining({
            constraintsVersioning: {
              gomodMod: 'config-version',
              go: 'go-version',
            },
          }),
        );
      });

      it('is set from packageFile if only set on packageFile', async () => {
        const packageFiles: any = {
          maven: [
            {
              packageFile: 'pom.xml',
              constraintsVersioning: { go: 'go-version' },
              deps: [{ datasource: MavenDatasource.id, depName: 'bbb' }],
            },
          ],
        };
        lookupUpdates.mockResolvedValue(
          Result.ok(partial<UpdateResult>({ updates: [] })),
        );

        await fetchUpdates(config, packageFiles);

        expect(lookupUpdates).toHaveBeenCalledWith(
          expect.objectContaining({
            constraintsVersioning: { go: 'go-version' },
          }),
        );
      });

      it('is not set if neither config nor packageFile are set', async () => {
        const packageFiles: any = {
          maven: [
            {
              packageFile: 'pom.xml',
              // no constraintsVersioning on pFile
              deps: [{ datasource: MavenDatasource.id, depName: 'bbb' }],
            },
          ],
        };
        lookupUpdates.mockResolvedValue(
          Result.ok(partial<UpdateResult>({ updates: [] })),
        );

        await fetchUpdates(config, packageFiles);

        expect(lookupUpdates).toHaveBeenCalledWith(
          expect.objectContaining({
            constraintsVersioning: {},
          }),
        );
      });

      it('is set if config is set', async () => {
        config.rangeStrategy = 'auto';
        config.constraintsVersioning = { gomodMod: 'config-version' };
        const packageFiles: any = {
          maven: [
            {
              packageFile: 'pom.xml',
              // no constraintsVersioning on pFile
              deps: [{ datasource: MavenDatasource.id, depName: 'bbb' }],
            },
          ],
        };
        lookupUpdates.mockResolvedValue(
          Result.ok(partial<UpdateResult>({ updates: [] })),
        );
        await fetchUpdates(config, packageFiles);
        expect(lookupUpdates).toHaveBeenCalledWith(
          expect.objectContaining({
            constraintsVersioning: { gomodMod: 'config-version' },
          }),
        );
      });

      it('is merged from dep with packageFile and config', async () => {
        config.constraintsVersioning = { '%goMod': 'config-version' };
        const packageFiles: any = {
          maven: [
            {
              packageFile: 'pom.xml',
              constraintsVersioning: {
                '%goMod': 'pfile-version',
                perl: 'pfile-perl-version',
              },
              deps: [
                {
                  datasource: MavenDatasource.id,
                  depName: 'bbb',
                  constraintsVersioning: {
                    '%goMod': 'dep-version',
                    perl: 'dep-perl-version',
                    vscode: 'dep-vscode-version',
                  },
                },
              ],
            },
          ],
        };
        lookupUpdates.mockResolvedValue(
          Result.ok(partial<UpdateResult>({ updates: [] })),
        );

        await fetchUpdates(config, packageFiles);

        expect(lookupUpdates).toHaveBeenCalledWith(
          expect.objectContaining({
            constraintsVersioning: {
              '%goMod': 'config-version',
              perl: 'pfile-perl-version',
              vscode: 'dep-vscode-version',
            },
          }),
        );
      });

      it('is set from dep if only set on dep', async () => {
        const packageFiles: any = {
          maven: [
            {
              packageFile: 'pom.xml',
              deps: [
                {
                  datasource: MavenDatasource.id,
                  depName: 'bbb',
                  constraintsVersioning: { perl: 'dep-perl-version' },
                },
              ],
            },
          ],
        };
        lookupUpdates.mockResolvedValue(
          Result.ok(partial<UpdateResult>({ updates: [] })),
        );

        await fetchUpdates(config, packageFiles);

        expect(lookupUpdates).toHaveBeenCalledWith(
          expect.objectContaining({
            constraintsVersioning: { perl: 'dep-perl-version' },
          }),
        );
      });
    });

    it('prefers configured constraints over extracted constraints', async () => {
      config.rangeStrategy = 'auto';
      config.constraints = { python: '>=3.9' };
      const packageFiles: any = {
        maven: [
          {
            packageFile: 'pom.xml',
            extractedConstraints: { python: '>=3.8' },
            deps: [
              {
                datasource: MavenDatasource.id,
                depName: 'bbb',
                extractedConstraints: { python: '<3.12' },
              },
            ],
          },
        ],
      };
      lookupUpdates.mockResolvedValue(
        Result.ok(partial<UpdateResult>({ updates: ['a', 'b'] as never })),
      );

      await fetchUpdates(config, packageFiles);

      expect(lookupUpdates).toHaveBeenCalledWith(
        expect.objectContaining({
          constraints: { python: '>=3.9' },
          datasource: 'maven',
          depName: 'bbb',
        }),
      );
      expect(packageFiles.maven[0].deps[0]).toEqual(
        expect.objectContaining({
          extractedConstraints: { python: '<3.12' },
          updates: ['a', 'b'],
        }),
      );
    });

    it('skips deps with empty names', async () => {
      const packageFiles: Record<string, PackageFile[]> = {
        docker: [
          {
            packageFile: 'values.yaml',
            deps: [
              { depName: '', currentValue: '2.8.11', datasource: 'docker' },
              { depName: 'abcd' },
              { currentValue: '2.8.11', datasource: 'docker' },
              { depName: ' ' },
              {},
              { depName: undefined },
              // oxlint-disable-next-line renovate/prefer-partial-in-specs -- intentionally invalid depName type to test invalid-name skip handling
              { depName: { oh: 'no' } as unknown as string },
            ],
          },
        ],
      };
      await fetchUpdates(config, packageFiles);
      expect(packageFiles.docker[0].deps[0].skipReason).toBe('invalid-name');
      expect(packageFiles.docker[0].deps[1].skipReason).toBeUndefined();
      expect(packageFiles.docker[0].deps[2].skipReason).toBe('invalid-name');
      expect(packageFiles.docker[0].deps[3].skipReason).toBe('invalid-name');
      expect(packageFiles.docker[0].deps[4].skipReason).toBe('invalid-name');
      expect(packageFiles.docker[0].deps[5].skipReason).toBe('invalid-name');
      expect(packageFiles.docker[0].deps[6].skipReason).toBe('invalid-name');
    });

    it('skips internal deps by default', async () => {
      const packageFiles: Record<string, PackageFile[]> = {
        docker: [
          {
            packageFile: 'values.yaml',
            deps: [
              {
                depName: 'dep-name',
                currentValue: '2.8.11',
                datasource: 'docker',
                isInternal: true,
              },
            ],
          },
        ],
      };
      await fetchUpdates(config, packageFiles);
      expect(packageFiles.docker[0].deps[0].skipReason).toBe(
        'internal-package',
      );
      expect(packageFiles.docker[0].deps[0].updates).toHaveLength(0);
    });

    it('fetch updates for internal deps if updateInternalDeps is true', async () => {
      config.updateInternalDeps = true;
      config.rangeStrategy = 'auto';
      const packageFiles: any = {
        maven: [
          {
            packageFile: 'pom.xml',
            deps: [
              {
                datasource: MavenDatasource.id,
                depName: 'bbb',
                isInternal: true,
              },
            ],
          },
        ],
      };
      lookupUpdates.mockResolvedValue(
        Result.ok(partial<UpdateResult>({ updates: ['a', 'b'] as never })),
      );
      await fetchUpdates(config, packageFiles);
      expect(packageFiles.maven[0].deps[0].updates).toHaveLength(2);
    });

    it('throws lookup errors for onboarded repos', async () => {
      config.rangeStrategy = 'auto';
      const packageFiles: any = {
        maven: [
          {
            packageFile: 'pom.xml',
            deps: [{ datasource: MavenDatasource.id, depName: 'bbb' }],
          },
        ],
      };
      lookupUpdates.mockRejectedValueOnce(new Error('some error'));

      await expect(
        fetchUpdates({ ...config, repoIsOnboarded: true }, packageFiles),
      ).rejects.toThrow('some error');
    });

    it('throws lookup errors for not onboarded repos', async () => {
      config.rangeStrategy = 'auto';
      const packageFiles: any = {
        maven: [
          {
            packageFile: 'pom.xml',
            deps: [{ datasource: MavenDatasource.id, depName: 'bbb' }],
          },
        ],
      };
      lookupUpdates.mockRejectedValueOnce(new Error('some error'));

      await expect(
        fetchUpdates({ ...config, repoIsOnboarded: true }, packageFiles),
      ).rejects.toThrow('some error');
    });

    it('produces external host warnings for not onboarded repos', async () => {
      config.rangeStrategy = 'auto';
      const packageFiles: any = {
        maven: [
          {
            packageFile: 'pom.xml',
            deps: [{ datasource: MavenDatasource.id, depName: 'bbb' }],
          },
        ],
      };
      const err = new ExternalHostError(new Error('some error'));
      lookupUpdates.mockRejectedValueOnce(err);

      await fetchUpdates({ ...config, repoIsOnboarded: false }, packageFiles);

      expect(packageFiles).toMatchObject({
        maven: [
          {
            deps: [
              {
                depName: 'bbb',
                warnings: [
                  { topic: 'Lookup Error', message: 'bbb: some error' },
                ],
              },
            ],
          },
        ],
      });
    });
  });
});
