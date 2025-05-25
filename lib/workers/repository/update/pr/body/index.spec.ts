import type { PackageFile } from '../../../../../modules/manager/types';
import { prDebugDataRe } from '../../../../../modules/platform/pr-body';
import * as _template from '../../../../../util/template';
import * as _changelogs from './changelogs';
import * as _configDescription from './config-description';
import * as _controls from './controls';
import * as _footer from './footer';
import * as _header from './header';
import * as _notes from './notes';
import * as _table from './updates-table';
import { getPrBody } from '.';
import { platform } from '~test/util';

vi.mock('./changelogs');
const changelogs = vi.mocked(_changelogs);

vi.mock('./config-description');
const configDescription = vi.mocked(_configDescription);

vi.mock('./controls');
const controls = vi.mocked(_controls);

vi.mock('./footer');
const footer = vi.mocked(_footer);

vi.mock('./header');
const header = vi.mocked(_header);

vi.mock('./notes');
const notes = vi.mocked(_notes);

vi.mock('./updates-table');
const table = vi.mocked(_table);

vi.mock('../../../../../util/template');
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

      platform.massageMarkdown.mockImplementation((x) => massagedMarkDown);
      template.compile.mockImplementation((x) => compiledContent);
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
