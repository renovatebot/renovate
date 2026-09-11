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

    it('applies root .tool-versions constraints to other package files', async () => {
      config.constraints = {};
      const packageFiles: any = {
        asdf: [
          {
            packageFile: '.tool-versions',
            extractedConstraints: { node: '19.9.0' },
            deps: [],
          },
        ],
        npm: [
          {
            packageFile: 'package.json',
            deps: [{ datasource: 'npm', depName: '@changesets/cli' }],
          },
        ],
      };
      lookupUpdates.mockResolvedValue(
        Result.ok(partial<UpdateResult>({ updates: [] })),
      );

      await fetchUpdates(config, packageFiles);

      expect(lookupUpdates).toHaveBeenCalledWith(
        expect.objectContaining({ constraints: { node: '19.9.0' } }),
      );
    });

    it('prefers root mise constraints over root .tool-versions constraints', async () => {
      config.constraints = {};
      const packageFiles: any = {
        asdf: [
          {
            packageFile: '.tool-versions',
            extractedConstraints: { node: '19.9.0' },
            deps: [],
          },
        ],
        mise: [
          {
            packageFile: 'mise.toml',
            extractedConstraints: { node: '22.11.0' },
            deps: [],
          },
        ],
        npm: [
          {
            packageFile: 'package.json',
            deps: [{ datasource: 'npm', depName: '@changesets/cli' }],
          },
        ],
      };
      lookupUpdates.mockResolvedValue(
        Result.ok(partial<UpdateResult>({ updates: [] })),
      );

      await fetchUpdates(config, packageFiles);

      expect(lookupUpdates).toHaveBeenCalledWith(
        expect.objectContaining({ constraints: { node: '22.11.0' } }),
      );
    });

    it('applies all root .mise.toml constraints to other package files', async () => {
      config.constraints = {};
      const packageFiles: any = {
        mise: [
          {
            packageFile: '.mise.toml',
            extractedConstraints: {
              bun: '1.3.0',
              node: '22.11.0',
              yarn: '4.5.0',
              npm: '11.0.0',
              pnpm: '10.34.5',
              vscode: '1.100.0',
            },
            deps: [],
          },
        ],
        npm: [
          {
            packageFile: 'package.json',
            deps: [{ datasource: 'npm', depName: '@changesets/cli' }],
          },
        ],
      };
      lookupUpdates.mockResolvedValue(
        Result.ok(partial<UpdateResult>({ updates: [] })),
      );

      await fetchUpdates(config, packageFiles);

      expect(lookupUpdates).toHaveBeenCalledWith(
        expect.objectContaining({
          constraints: {
            bun: '1.3.0',
            node: '22.11.0',
            yarn: '4.5.0',
            npm: '11.0.0',
            pnpm: '10.34.5',
            vscode: '1.100.0',
          },
        }),
      );
    });

    it('prefers configured constraints over inferred runtime constraints', async () => {
      config.constraints = { node: '20.0.0' };
      const packageFiles: any = {
        asdf: [
          {
            packageFile: '.tool-versions',
            extractedConstraints: { node: '19.9.0' },
            deps: [],
          },
        ],
        npm: [
          {
            packageFile: 'package.json',
            deps: [{ datasource: 'npm', depName: '@changesets/cli' }],
          },
        ],
      };
      lookupUpdates.mockResolvedValue(
        Result.ok(partial<UpdateResult>({ updates: [] })),
      );

      await fetchUpdates(config, packageFiles);

      expect(lookupUpdates).toHaveBeenCalledWith(
        expect.objectContaining({ constraints: { node: '20.0.0' } }),
      );
    });

    it('prefers package-file constraints over inferred runtime constraints', async () => {
      config.constraints = {};
      const packageFiles: any = {
        asdf: [
          {
            packageFile: '.tool-versions',
            extractedConstraints: { node: '19.9.0' },
            deps: [],
          },
        ],
        npm: [
          {
            packageFile: 'package.json',
            extractedConstraints: { node: '18.0.0' },
            deps: [{ datasource: 'npm', depName: '@changesets/cli' }],
          },
        ],
      };
      lookupUpdates.mockResolvedValue(
        Result.ok(partial<UpdateResult>({ updates: [] })),
      );

      await fetchUpdates(config, packageFiles);

      expect(lookupUpdates).toHaveBeenCalledWith(
        expect.objectContaining({ constraints: { node: '18.0.0' } }),
      );
    });

    it('prefers dependency constraints over inferred runtime constraints', async () => {
      config.constraints = {};
      const packageFiles: any = {
        asdf: [
          {
            packageFile: '.tool-versions',
            extractedConstraints: { node: '19.9.0' },
            deps: [],
          },
        ],
        npm: [
          {
            packageFile: 'package.json',
            deps: [
              {
                datasource: 'npm',
                depName: '@changesets/cli',
                extractedConstraints: { node: '18.0.0' },
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
        expect.objectContaining({ constraints: { node: '18.0.0' } }),
      );
    });

    it('prefers manager-scoped constraints over inferred runtime constraints', async () => {
      config.constraints = {};
      // @ts-expect-error -- manager configurations are dynamically addressed
      config.npm = { constraints: { node: '20.0.0' } };
      const packageFiles: any = {
        asdf: [
          {
            packageFile: '.tool-versions',
            extractedConstraints: { node: '19.9.0' },
            deps: [],
          },
        ],
        npm: [
          {
            packageFile: 'package.json',
            deps: [{ datasource: 'npm', depName: '@changesets/cli' }],
          },
        ],
      };
      lookupUpdates.mockResolvedValue(
        Result.ok(partial<UpdateResult>({ updates: [] })),
      );

      await fetchUpdates(config, packageFiles);

      expect(lookupUpdates).toHaveBeenCalledWith(
        expect.objectContaining({ constraints: { node: '20.0.0' } }),
      );
    });

    it('does not apply nested runtime constraints to other package files', async () => {
      config.constraints = {};
      const packageFiles: any = {
        asdf: [
          {
            packageFile: 'subdir/.tool-versions',
            extractedConstraints: { node: '19.9.0' },
            deps: [],
          },
        ],
        mise: [
          {
            packageFile: 'subdir/mise.toml',
            extractedConstraints: { node: '22.11.0' },
            deps: [],
          },
          {
            packageFile: 'subdir/.mise.toml',
            extractedConstraints: { pnpm: '10.34.5' },
            deps: [],
          },
        ],
        npm: [
          {
            packageFile: 'package.json',
            deps: [{ datasource: 'npm', depName: '@changesets/cli' }],
          },
        ],
      };
      lookupUpdates.mockResolvedValue(
        Result.ok(partial<UpdateResult>({ updates: [] })),
      );

      await fetchUpdates(config, packageFiles);

      expect(lookupUpdates).toHaveBeenCalledWith(
        expect.objectContaining({ constraints: {} }),
      );
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
    });

    it('prefers dependency extracted constraints over configured constraints', async () => {
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
          constraints: { python: '<3.12' },
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
