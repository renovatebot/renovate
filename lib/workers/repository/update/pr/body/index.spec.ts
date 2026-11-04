import { partial, platform } from '~test/util.ts';
import { getConfig } from '../../../../../config/defaults.ts';
import {
  getManagerConfig,
  mergeChildConfig,
} from '../../../../../config/index.ts';
import type { PackageFile } from '../../../../../modules/manager/types.ts';
import { prDebugDataRe } from '../../../../../modules/platform/pr-body.ts';
import * as _template from '../../../../../util/template/index.ts';
import type { BranchUpgradeConfig } from '../../../../types.ts';
import * as _changelogs from './changelogs.ts';
import * as _configDescription from './config-description.ts';
import * as _controls from './controls.ts';
import * as _footer from './footer.ts';
import * as _header from './header.ts';
import { getPrBody } from './index.ts';
import * as _notes from './notes.ts';
import * as _table from './updates-table.ts';

vi.mock('./changelogs.ts');
const changelogs = vi.mocked(_changelogs);

vi.mock('./config-description.ts');
const configDescription = vi.mocked(_configDescription);

vi.mock('./controls.ts');
const controls = vi.mocked(_controls);

vi.mock('./footer.ts');
const footer = vi.mocked(_footer);

vi.mock('./header.ts');
const header = vi.mocked(_header);

vi.mock('./notes.ts');
const notes = vi.mocked(_notes);

vi.mock('./updates-table.ts');
const table = vi.mocked(_table);

vi.mock('../../../../../util/template/index.ts');
const template = vi.mocked(_template);

describe('workers/repository/update/pr/body/index', () => {
  describe('getPrBody', () => {
    beforeEach(() => {
      changelogs.getChangelogs.mockReturnValueOnce('getChangelogs');
      configDescription.getPrConfigDescription.mockReturnValueOnce(
        'getPrConfigDescription',
      );
      controls.getControls.mockReturnValueOnce('getControls');
      footer.getPrFooter.mockReturnValueOnce('getPrFooter');
      header.getPrHeader.mockReturnValueOnce('getPrHeader');
      notes.getPrExtraNotes.mockReturnValueOnce('getPrExtraNotes');
      notes.getPrNotes.mockReturnValueOnce('getPrNotes');
      table.getPrUpdatesTable.mockReturnValueOnce('getPrUpdatesTable');
    });

    it('handles empty template', () => {
      const res = getPrBody(
        {
          manager: 'some-manager',
          branchName: 'some-branch',
          baseBranch: 'base',
          upgrades: [],
        },
        {
          debugData: {
            updatedInVer: '1.2.3',
            createdInVer: '1.2.3',
            targetBranch: 'base',
          },
        },
        {},
      );
      expect(res).toBeEmptyString();
    });

    it('leaves an upgrade with no links unlinked', () => {
      template.compile.mockImplementation((x) => x);

      const upgrade = {
        manager: 'some-manager',
        branchName: 'some-branch',
        depName: 'some-dep',
      };

      getPrBody(
        {
          manager: 'some-manager',
          baseBranch: 'base',
          branchName: 'some-branch',
          upgrades: [upgrade],
        },
        {
          debugData: {
            updatedInVer: '1.2.3',
            createdInVer: '1.2.3',
            targetBranch: 'base',
          },
        },
        {},
      );

      expect(upgrade).toMatchObject({
        depNameLinked: 'some-dep',
        references: '',
      });
    });

    it('shows the registry crate and local alias in the updates table', async () => {
      const actualTemplate = await vi.importActual<typeof _template>(
        '../../../../../util/template/index.ts',
      );
      const actualTable =
        await vi.importActual<typeof _table>('./updates-table.ts');
      template.compile.mockImplementation(actualTemplate.compile);
      table.getPrUpdatesTable.mockReset();
      table.getPrUpdatesTable.mockImplementation(actualTable.getPrUpdatesTable);
      platform.massageMarkdown.mockImplementation((x) => x);
      const managerConfig = getManagerConfig(
        mergeChildConfig(getConfig(), {
          prBodyDefinitions: { Alias: '{{{depNameLinked}}}' },
        }),
        'cargo',
      );
      const upgrade = partial<BranchUpgradeConfig>({
        manager: 'cargo',
        datasource: 'crate',
        depName: 'divan',
        packageName: 'codspeed-divan-compat',
        dependencyUrl: 'https://crates.io/crates/codspeed-divan-compat',
        depType: 'workspace.dependencies',
        updateType: 'major',
        currentValue: '5.0.0',
        newValue: '6.0.0',
        newVersion: '6.0.0',
        displayFrom: '5.0.0',
        displayTo: '6.0.0',
        prBodyDefinitions: managerConfig.prBodyDefinitions,
      });

      const result = getPrBody(
        {
          manager: 'cargo',
          branchName: 'renovate/divan-6.x',
          baseBranch: 'main',
          upgrades: [upgrade],
          prBodyColumns: ['Package', 'Alias', 'Type', 'Update', 'Change'],
          prBodyTemplate: '{{{table}}}',
        },
        {
          debugData: {
            updatedInVer: '1.2.3',
            createdInVer: '1.2.3',
            targetBranch: 'main',
          },
        },
        {},
      );

      expect(result).toContain(
        '| [codspeed-divan-compat](https://crates.io/crates/codspeed-divan-compat) (aliased as `divan`) | [divan](https://crates.io/crates/codspeed-divan-compat) | workspace.dependencies | major | `5.0.0` → `6.0.0` |',
      );
      expect(upgrade).toMatchObject({
        depName: 'divan',
        packageName: 'codspeed-divan-compat',
        currentValue: '5.0.0',
        newValue: '6.0.0',
        newVersion: '6.0.0',
        depNameLinked:
          '[divan](https://crates.io/crates/codspeed-divan-compat)',
        packageNameLinked:
          '[codspeed-divan-compat](https://crates.io/crates/codspeed-divan-compat)',
      });
    });

    it('keeps aliases distinct in a mixed updates table', async () => {
      const actualTemplate = await vi.importActual<typeof _template>(
        '../../../../../util/template/index.ts',
      );
      const actualTable =
        await vi.importActual<typeof _table>('./updates-table.ts');
      template.compile.mockImplementation(actualTemplate.compile);
      table.getPrUpdatesTable.mockReset();
      table.getPrUpdatesTable.mockImplementation(actualTable.getPrUpdatesTable);
      platform.massageMarkdown.mockImplementation((x) => x);
      const config = mergeChildConfig(getConfig(), {
        prBodyDefinitions: { Alias: '{{{depNameLinked}}}' },
      });
      const upgrades = [
        partial<BranchUpgradeConfig>({
          manager: 'cargo',
          datasource: 'crate',
          depName: 'divan',
          packageName: 'codspeed-divan-compat',
          dependencyUrl: 'https://crates.io/crates/codspeed-divan-compat',
        }),
        partial<BranchUpgradeConfig>({
          manager: 'cargo',
          datasource: 'crate',
          depName: 'other-alias',
          packageName: 'codspeed-divan-compat',
          dependencyUrl: 'https://crates.io/crates/codspeed-divan-compat',
        }),
        partial<BranchUpgradeConfig>({
          manager: 'npm',
          datasource: 'npm',
          depName: 'local-alias',
          packageName: 'registry-name',
          homepage: 'https://example.com',
          newName: 'replacement',
        }),
      ];
      for (const upgrade of upgrades) {
        upgrade.updateType = 'major';
        upgrade.currentVersion = '5.0.0';
        upgrade.newVersion = '6.0.0';
        upgrade.displayFrom = '5.0.0';
        upgrade.displayTo = '6.0.0';
        upgrade.prBodyDefinitions = getManagerConfig(
          config,
          upgrade.manager,
        ).prBodyDefinitions;
      }

      const result = getPrBody(
        {
          manager: 'npm',
          branchName: 'renovate/group',
          baseBranch: 'main',
          upgrades,
          prBodyColumns: ['Package', 'Alias', 'Change'],
          prBodyTemplate: '{{{table}}}',
        },
        {
          debugData: {
            updatedInVer: '1.2.3',
            createdInVer: '1.2.3',
            targetBranch: 'main',
          },
        },
        {},
      );

      expect(result).toContain(
        '| [codspeed-divan-compat](https://crates.io/crates/codspeed-divan-compat) (aliased as `divan`) | [divan](https://crates.io/crates/codspeed-divan-compat) | `5.0.0` → `6.0.0` |',
      );
      expect(result).toContain(
        '| [codspeed-divan-compat](https://crates.io/crates/codspeed-divan-compat) (aliased as `other-alias`) | [other-alias](https://crates.io/crates/codspeed-divan-compat) | `5.0.0` → `6.0.0` |',
      );
      expect(result).toContain(
        '| [local-alias](https://example.com) → [replacement](https://example.com) | [local-alias](https://example.com) | [`5.0.0` → `6.0.0`](https://renovatebot.com/diffs/npm/local-alias/5.0.0/6.0.0) |',
      );
      expect(
        upgrades.map(({ manager, datasource, depName, packageName }) => ({
          manager,
          datasource,
          depName,
          packageName,
        })),
      ).toEqual([
        {
          manager: 'cargo',
          datasource: 'crate',
          depName: 'divan',
          packageName: 'codspeed-divan-compat',
        },
        {
          manager: 'cargo',
          datasource: 'crate',
          depName: 'other-alias',
          packageName: 'codspeed-divan-compat',
        },
        {
          manager: 'npm',
          datasource: 'npm',
          depName: 'local-alias',
          packageName: 'registry-name',
        },
      ]);
    });

    it.each`
      scope      | userConfig
      ${'root'}  | ${{ prBodyDefinitions: { Package: '{{{depNameLinked}}}' } }}
      ${'cargo'} | ${{ cargo: { prBodyDefinitions: { Package: '{{{depNameLinked}}}' } } }}
    `(
      'preserves an explicit $scope Package template',
      async ({ userConfig }) => {
        const actualTemplate = await vi.importActual<typeof _template>(
          '../../../../../util/template/index.ts',
        );
        const actualTable =
          await vi.importActual<typeof _table>('./updates-table.ts');
        template.compile.mockImplementation(actualTemplate.compile);
        table.getPrUpdatesTable.mockReset();
        table.getPrUpdatesTable.mockImplementation(
          actualTable.getPrUpdatesTable,
        );
        platform.massageMarkdown.mockImplementation((x) => x);
        const managerConfig = getManagerConfig(
          mergeChildConfig(
            mergeChildConfig(getConfig(), {
              prBodyDefinitions: { Alias: '{{{depNameLinked}}}' },
            }),
            userConfig,
          ),
          'cargo',
        );
        const upgrade = partial<BranchUpgradeConfig>({
          manager: 'cargo',
          datasource: 'crate',
          depName: 'divan',
          packageName: 'codspeed-divan-compat',
          dependencyUrl: 'https://crates.io/crates/codspeed-divan-compat',
          prBodyDefinitions: managerConfig.prBodyDefinitions,
        });

        const result = getPrBody(
          {
            manager: 'cargo',
            branchName: 'renovate/divan-6.x',
            baseBranch: 'main',
            upgrades: [upgrade],
            prBodyColumns: ['Package', 'Alias'],
            prBodyTemplate: '{{{table}}}',
          },
          {
            debugData: {
              updatedInVer: '1.2.3',
              createdInVer: '1.2.3',
              targetBranch: 'main',
            },
          },
          {},
        );

        expect(result).toContain(
          '| [divan](https://crates.io/crates/codspeed-divan-compat) | [divan](https://crates.io/crates/codspeed-divan-compat) |',
        );
        expect(result).not.toContain('aliased as');
        expect(upgrade).toMatchObject({
          depName: 'divan',
          packageName: 'codspeed-divan-compat',
          depNameLinked:
            '[divan](https://crates.io/crates/codspeed-divan-compat)',
        });
      },
    );

    it.each`
      manager    | datasource       | depName      | packageName                   | expected
      ${'cargo'} | ${'crate'}       | ${'serde'}   | ${'serde'}                    | ${'serde'}
      ${'cargo'} | ${'crate'}       | ${'serde'}   | ${undefined}                  | ${'serde'}
      ${'cargo'} | ${'crate'}       | ${'serde'}   | ${''}                         | ${'serde'}
      ${'cargo'} | ${'crate'}       | ${''}        | ${'serde'}                    | ${''}
      ${'cargo'} | ${'crate'}       | ${undefined} | ${'serde'}                    | ${undefined}
      ${'cargo'} | ${'github-tags'} | ${'alias'}   | ${'owner/repository'}         | ${'alias'}
      ${'cargo'} | ${'gitlab-tags'} | ${'alias'}   | ${'owner/repository'}         | ${'alias'}
      ${'cargo'} | ${'git-tags'}    | ${'alias'}   | ${'https://example.com/repo'} | ${'alias'}
      ${'cargo'} | ${'git-refs'}    | ${'alias'}   | ${'https://example.com/repo'} | ${'alias'}
      ${'npm'}   | ${'npm'}         | ${'alias'}   | ${'another-package'}          | ${'alias'}
    `(
      'preserves $manager/$datasource display for $depName/$packageName',
      ({ manager, datasource, depName, packageName, expected }) => {
        const upgrade = partial<BranchUpgradeConfig>({
          manager,
          datasource,
          depName,
          packageName,
        });

        getPrBody(
          {
            manager,
            branchName: 'some-branch',
            baseBranch: 'base',
            upgrades: [upgrade],
          },
          {
            debugData: {
              updatedInVer: '1.2.3',
              createdInVer: '1.2.3',
              targetBranch: 'base',
            },
          },
          {},
        );

        expect(upgrade).toMatchObject({
          depName,
          packageName,
          depNameLinked: expected,
        });
        expect(upgrade).not.toHaveProperty('packageNameLinked');
      },
    );

    it.each`
      homepage                 | sourceUrl                                        | dependencyUrl                                       | changelogUrl                       | expectedPackage                                                                                                                                       | expectedAlias                                                                                                                         | expectedNewName
      ${undefined}             | ${undefined}                                     | ${undefined}                                        | ${undefined}                       | ${'codspeed-divan-compat'}                                                                                                                            | ${'divan'}                                                                                                                            | ${'replacement'}
      ${undefined}             | ${undefined}                                     | ${'https://crates.io/crates/codspeed-divan-compat'} | ${undefined}                       | ${'[codspeed-divan-compat](https://crates.io/crates/codspeed-divan-compat)'}                                                                          | ${'[divan](https://crates.io/crates/codspeed-divan-compat)'}                                                                          | ${'[replacement](https://crates.io/crates/codspeed-divan-compat)'}
      ${undefined}             | ${'https://github.com/CodSpeedHQ/codspeed-rust'} | ${'https://crates.io/crates/codspeed-divan-compat'} | ${undefined}                       | ${'[codspeed-divan-compat](https://github.com/CodSpeedHQ/codspeed-rust)'}                                                                             | ${'[divan](https://github.com/CodSpeedHQ/codspeed-rust)'}                                                                             | ${'[replacement](https://github.com/CodSpeedHQ/codspeed-rust)'}
      ${'https://codspeed.io'} | ${'https://github.com/CodSpeedHQ/codspeed-rust'} | ${'https://crates.io/crates/codspeed-divan-compat'} | ${'https://codspeed.io/changelog'} | ${'[codspeed-divan-compat](https://codspeed.io) ([source](https://github.com/CodSpeedHQ/codspeed-rust), [changelog](https://codspeed.io/changelog))'} | ${'[divan](https://codspeed.io) ([source](https://github.com/CodSpeedHQ/codspeed-rust), [changelog](https://codspeed.io/changelog))'} | ${'[replacement](https://codspeed.io)'}
    `(
      'preserves Cargo alias links for $homepage/$sourceUrl/$dependencyUrl',
      ({
        homepage,
        sourceUrl,
        dependencyUrl,
        changelogUrl,
        expectedPackage,
        expectedAlias,
        expectedNewName,
      }) => {
        template.compile.mockImplementation((x) => x);
        const upgrade = partial<BranchUpgradeConfig>({
          manager: 'cargo',
          datasource: 'crate',
          depName: 'divan',
          packageName: 'codspeed-divan-compat',
          homepage,
          sourceUrl,
          dependencyUrl,
          changelogUrl,
          newName: 'replacement',
        });

        getPrBody(
          {
            manager: 'cargo',
            branchName: 'some-branch',
            baseBranch: 'base',
            upgrades: [upgrade],
          },
          {
            debugData: {
              updatedInVer: '1.2.3',
              createdInVer: '1.2.3',
              targetBranch: 'base',
            },
          },
          {},
        );

        expect(upgrade).toMatchObject({
          depName: 'divan',
          packageName: 'codspeed-divan-compat',
          depNameLinked: expectedAlias,
          packageNameLinked: expectedPackage,
          newNameLinked: expectedNewName,
        });
      },
    );

    it('massages upgrades', () => {
      template.compile.mockImplementation((x) => x);

      const upgrade = {
        manager: 'some-manager',
        branchName: 'some-branch',
        dependencyUrl: 'https://github.com/foo/bar',
        sourceUrl: 'https://github.com/foo/bar',
        sourceDirectory: '/baz',
        changelogUrl:
          'https://raw.githubusercontent.com/foo/bar/tree/main/CHANGELOG.md',
        homepage: 'https://example.com',
      };

      const upgrade1 = {
        manager: 'some-manager',
        branchName: 'some-branch',
        sourceUrl: 'https://github.com/foo/bar',
        homepage: 'https://example.com',
      };

      const upgradeBitbucket = {
        manager: 'some-manager',
        branchName: 'some-branch',
        sourceUrl: 'https://bitbucket.org/foo/bar',
        sourceDirectory: '/baz',
        changelogUrl: 'https://bitbucket.org/foo/bar/src/main/CHANGELOG.md',
        homepage: 'https://example.com',
      };

      const upgradeBitbucketServer = {
        manager: 'some-manager',
        branchName: 'some-branch',
        sourceUrl: 'https://bitbucket.domain.org/projects/foo/repos/bar',
        sourceDirectory: '/baz',
        homepage: 'https://example.com',
        changelogUrl:
          'https://bitbucket.domain.org/projects/foo/repos/bar/browse/CHANGELOG.md',
      };

      getPrBody(
        {
          manager: 'some-manager',
          baseBranch: 'base',
          branchName: 'some-branch',
          upgrades: [
            upgrade,
            upgrade1,
            upgradeBitbucket,
            upgradeBitbucketServer,
          ],
        },
        {
          debugData: {
            updatedInVer: '1.2.3',
            createdInVer: '1.2.3',
            targetBranch: 'base',
          },
        },
        {},
      );

      expect(upgrade).toMatchObject({
        branchName: 'some-branch',
        changelogUrl:
          'https://raw.githubusercontent.com/foo/bar/tree/main/CHANGELOG.md',
        depNameLinked:
          '[undefined](https://example.com) ([source](https://github.com/foo/bar/tree/HEAD/baz), [changelog](https://raw.githubusercontent.com/foo/bar/tree/main/CHANGELOG.md))',
        dependencyUrl: 'https://github.com/foo/bar',
        homepage: 'https://example.com',
        references:
          '[homepage](https://example.com), [source](https://github.com/foo/bar/tree/HEAD/baz), [changelog](https://raw.githubusercontent.com/foo/bar/tree/main/CHANGELOG.md)',
        sourceDirectory: '/baz',
        sourceUrl: 'https://github.com/foo/bar',
      });
      expect(upgrade1).toMatchObject({
        branchName: 'some-branch',
        depNameLinked:
          '[undefined](https://example.com) ([source](https://github.com/foo/bar))',
        references:
          '[homepage](https://example.com), [source](https://github.com/foo/bar)',
        homepage: 'https://example.com',
        sourceUrl: 'https://github.com/foo/bar',
      });
      expect(upgradeBitbucket).toMatchObject({
        branchName: 'some-branch',
        depNameLinked:
          '[undefined](https://example.com) ([source](https://bitbucket.org/foo/bar/src/HEAD/baz), [changelog](https://bitbucket.org/foo/bar/src/main/CHANGELOG.md))',
        references:
          '[homepage](https://example.com), [source](https://bitbucket.org/foo/bar/src/HEAD/baz), [changelog](https://bitbucket.org/foo/bar/src/main/CHANGELOG.md)',
        homepage: 'https://example.com',
        sourceUrl: 'https://bitbucket.org/foo/bar',
      });
      expect(upgradeBitbucketServer).toMatchObject({
        branchName: 'some-branch',
        depNameLinked:
          '[undefined](https://example.com) ([source](https://bitbucket.domain.org/projects/foo/repos/bar/browse/baz), [changelog](https://bitbucket.domain.org/projects/foo/repos/bar/browse/CHANGELOG.md))',
        references:
          '[homepage](https://example.com), [source](https://bitbucket.domain.org/projects/foo/repos/bar/browse/baz), [changelog](https://bitbucket.domain.org/projects/foo/repos/bar/browse/CHANGELOG.md)',
        homepage: 'https://example.com',
        sourceUrl: 'https://bitbucket.domain.org/projects/foo/repos/bar',
      });
    });

    it('templates changelogUrl', () => {
      template.compile.mockImplementation((x) =>
        x === '{{ testTemplate }}'
          ? 'https://raw.githubusercontent.com/some/templated/CHANGELOG.md'
          : x,
      );

      const upgrade = {
        manager: 'some-manager',
        branchName: 'some-branch',
        dependencyUrl: 'https://github.com/foo/bar',
        sourceUrl: 'https://github.com/foo/bar',
        sourceDirectory: '/baz',
        changelogUrl: '{{ testTemplate }}',
        homepage: 'https://example.com',
      };

      getPrBody(
        {
          manager: 'some-manager',
          baseBranch: 'base',
          branchName: 'some-branch',
          upgrades: [upgrade],
        },
        {
          debugData: {
            updatedInVer: '1.2.3',
            createdInVer: '1.2.3',
            targetBranch: 'base',
          },
        },
        {},
      );

      expect(upgrade).toMatchObject({
        branchName: 'some-branch',
        changelogUrl: '{{ testTemplate }}',
        depNameLinked:
          '[undefined](https://example.com) ([source](https://github.com/foo/bar/tree/HEAD/baz), [changelog](https://raw.githubusercontent.com/some/templated/CHANGELOG.md))',
        dependencyUrl: 'https://github.com/foo/bar',
        homepage: 'https://example.com',
        references:
          '[homepage](https://example.com), [source](https://github.com/foo/bar/tree/HEAD/baz), [changelog](https://raw.githubusercontent.com/some/templated/CHANGELOG.md)',
        sourceDirectory: '/baz',
        sourceUrl: 'https://github.com/foo/bar',
      });
    });

    it('uses dependencyUrl as primary link', () => {
      const upgrade = {
        manager: 'some-manager',
        branchName: 'some-branch',
        dependencyUrl: 'https://github.com/foo/bar',
      };

      getPrBody(
        {
          manager: 'some-manager',
          baseBranch: 'base',
          branchName: 'some-branch',
          upgrades: [upgrade],
        },
        {
          debugData: {
            updatedInVer: '1.2.3',
            createdInVer: '1.2.3',
            targetBranch: 'base',
          },
        },
        {},
      );

      expect(upgrade).toMatchObject({
        branchName: 'some-branch',
        depNameLinked: '[undefined](https://github.com/foo/bar)',
        dependencyUrl: 'https://github.com/foo/bar',
        references: '',
      });
    });

    it('compiles template', () => {
      platform.massageMarkdown.mockImplementation((x) => x);
      template.compile.mockImplementation((x) => x);
      const res = getPrBody(
        {
          manager: 'some-manager',
          branchName: 'some-branch',
          baseBranch: 'base',
          upgrades: [],
          prBodyTemplate: 'PR BODY',
        },
        {
          debugData: {
            updatedInVer: '1.2.3',
            createdInVer: '1.2.3',
            targetBranch: 'base',
          },
        },
        {},
      );
      expect(res).toContain('PR BODY');
      expect(res).toContain(`<!--renovate-debug`);
    });

    it('supports custom rebasing message', () => {
      platform.massageMarkdown.mockImplementation((x) => x);
      template.compile.mockImplementation((x) => x);
      const res = getPrBody(
        {
          manager: 'some-manager',
          baseBranch: 'base',
          branchName: 'some-branch',
          upgrades: [],
          prBodyTemplate: ['aaa', '**Rebasing**: FOO', 'bbb'].join('\n'),
        },
        {
          rebasingNotice: 'BAR',
          debugData: {
            updatedInVer: '1.2.3',
            createdInVer: '1.2.3',
            targetBranch: 'base',
          },
        },
        {},
      );
      expect(res).toContain(['aaa', '**Rebasing**: BAR', 'bbb'].join('\n'));
    });

    it('updates PR due to body change without pr data', () => {
      platform.massageMarkdown.mockImplementation((x) => x);
      template.compile.mockImplementation((x) => x);
      const res = getPrBody(
        {
          manager: 'some-manager',
          branchName: 'some-branch',
          upgrades: [],
          baseBranch: 'base',
          prBodyTemplate: 'PR BODY',
        },
        {
          debugData: {
            updatedInVer: '1.2.3',
            createdInVer: '1.2.3',
            targetBranch: 'base',
          },
        },
        {},
      );

      const match = prDebugDataRe.exec(res);
      expect(match?.groups?.payload).toBeString();
    });

    it('pr body warning', () => {
      const massagedMarkDown =
        '---\n\n### ⚠ Dependency Lookup Warnings ⚠\n\n' +
        'Warnings were logged while processing this repo. ' +
        'Please check the Dependency Dashboard for more information\n\n---';

      const compiledContent =
        '---\n\n\n\n### ⚠ Dependency Lookup Warnings ⚠' +
        '\n\n\n\nWarnings were logged while processing this repo. ' +
        'Please check the Dependency Dashboard for more information\n\n\n\n---';

      platform.massageMarkdown.mockImplementation(() => massagedMarkDown);
      template.compile.mockImplementation(() => compiledContent);
      const packageFiles: Record<string, PackageFile[]> = {
        npm: [
          {
            packageFile: 'package.json',
            deps: [
              {
                warnings: [{ message: 'Warning 1', topic: '' }],
              },
              {},
            ],
          },
        ],
      };

      const res = getPrBody(
        {
          manager: 'some-manager',
          branchName: 'some-branch',
          upgrades: [],
          packageFiles,
          prBodyTemplate: '{{{warnings}}}',
          baseBranch: 'base',
        },
        {
          debugData: {
            updatedInVer: '1.2.3',
            createdInVer: '1.2.3',
            targetBranch: 'base',
          },
        },
        {},
      );
      const expected =
        '---\n\n### ⚠ Dependency Lookup Warnings ⚠' +
        '\n\nWarnings were logged while processing this repo. ' +
        'Please check the Dependency Dashboard for more information\n\n---';
      expect(res).toBe(expected);
    });
  });
});
