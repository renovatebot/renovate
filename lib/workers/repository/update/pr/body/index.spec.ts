import { codeBlock } from 'common-tags';
import { platform } from '~test/util.ts';
import type { PackageFile } from '../../../../../modules/manager/types.ts';
import { prDebugDataRe } from '../../../../../modules/platform/pr-body.ts';
import { smartTruncate } from '../../../../../modules/platform/utils/pr-body.ts';
import * as _template from '../../../../../util/template/index.ts';
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
      platform.maxBodyLength.mockReturnValue(Infinity);
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

    describe('when the body exceeds the platform limit', () => {
      const advisory = codeBlock`
        <details>
        <summary>More information</summary>

        #### Details
        ${'Vuln: java.nio.file.Path deserialization\n\n'.repeat(100)}
        </details>
      `;
      const changelog = `\n\n---\n\n<details>\n<summary>dep</summary>\n\n${'- a change\n\n'.repeat(200)}</details>\n\n`;

      const limit = 2000;
      const configurationText =
        '\n\n---\n\n### Configuration\n\nSome schedule.\n';
      const controlsText =
        '\n\n---\n\n - [ ] <!-- rebase-check -->Rebase this PR, check this box\n';
      const footerText = '\n\n---\n\nThis PR was generated by Renovate.';

      function expectKeptTail(body: string): void {
        expect(body).toContain('### Configuration');
        expect(body).toContain('<!-- rebase-check -->');
        expect(body).toContain('This PR was generated by Renovate.');
        expect(body).toContain('<!--renovate-debug:');
      }

      // like the platforms, truncate the massaged body to the limit
      function massageLikePlatform(body: string): string {
        return smartTruncate(body, limit);
      }

      function getBody(
        prBodyTemplate: string,
        sections: { notes: string; changelogs: string },
        massage: (body: string) => string = massageLikePlatform,
      ): string {
        platform.maxBodyLength.mockReturnValue(limit);
        platform.massageMarkdown.mockImplementation(massage);
        configDescription.getPrConfigDescription
          .mockReset()
          .mockReturnValue(configurationText);
        controls.getControls.mockReset().mockReturnValue(controlsText);
        footer.getPrFooter.mockReset().mockReturnValue(footerText);
        template.compile.mockImplementation((tpl, content) =>
          tpl.replace(
            /\{\{\{(?<name>\w+)\}\}\}/g,
            (_, name: string) => (content as Record<string, string>)[name],
          ),
        );
        notes.getPrNotes.mockReset().mockReturnValue(sections.notes);
        notes.getPrExtraNotes.mockReset().mockReturnValue('');
        changelogs.getChangelogs
          .mockReset()
          .mockReturnValue(sections.changelogs);

        return getPrBody(
          {
            manager: 'some-manager',
            branchName: 'some-branch',
            baseBranch: 'base',
            upgrades: [],
            prBodyTemplate,
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
      }

      const defaultTemplate =
        '{{{header}}}{{{table}}}{{{warnings}}}{{{notes}}}{{{changelogs}}}{{{configDescription}}}{{{controls}}}{{{footer}}}';

      it('keeps the configuration, controls, footer and debug comment when the advisories exceed the limit', () => {
        const res = getBody(defaultTemplate, {
          notes: advisory,
          changelogs: '',
        });

        expect(res.length).toBeLessThanOrEqual(limit);
        expectKeptTail(res);
      });

      it('keeps the fixed text, controls, footer and debug comment of a template without a release notes heading', () => {
        const res = getBody(
          '{{{notes}}}\n\nCUSTOM FIXED TEXT{{{controls}}}{{{footer}}}',
          { notes: advisory, changelogs: changelog },
        );

        expect(res.length).toBeLessThanOrEqual(limit);
        expect(res).toContain('CUSTOM FIXED TEXT');
        expect(res).toContain('<!-- rebase-check -->');
        expect(res).toContain('This PR was generated by Renovate.');
        expect(res).toContain('<!--renovate-debug:');
      });

      it('keeps the configuration, controls, footer and debug comment when link rewriting grows the body past the limit', () => {
        const links = '[link](https://github.com/some/repo)\n\n'.repeat(40);
        function rewriteLinks(body: string): string {
          return smartTruncate(
            body.replaceAll('github.com', 'redirect.github.com'),
            limit,
          );
        }

        const res = getBody(
          defaultTemplate,
          { notes: 'short notes', changelogs: links },
          rewriteLinks,
        );

        expect(res.length).toBeLessThanOrEqual(limit);
        expectKeptTail(res);
      });
    });

    describe('when the sections are cut to fit the platform limit', () => {
      const advisory = codeBlock`
        <details>
        <summary>More information</summary>

        #### Details
        ${'Vuln: java.nio.file.Path deserialization\n\n'.repeat(100)}
        </details>
      `;
      const changelog = `\n\n---\n\n<details>\n<summary>dep</summary>\n\n${'- a change\n\n'.repeat(200)}</details>\n\n`;

      function getBody(
        prBodyTemplate: string,
        sections: { notes: string; changelogs: string },
        massage: (body: string) => string = (x) => x,
      ): string {
        platform.maxBodyLength.mockReturnValue(2000);
        platform.massageMarkdown.mockImplementation(massage);
        template.compile.mockImplementation((tpl, content) =>
          tpl.replace(
            /\{\{\{(?<name>\w+)\}\}\}/g,
            (_, name: string) => (content as Record<string, string>)[name],
          ),
        );
        notes.getPrNotes.mockReset().mockReturnValue(sections.notes);
        notes.getPrExtraNotes.mockReset().mockReturnValue('');
        changelogs.getChangelogs
          .mockReset()
          .mockReturnValue(sections.changelogs);

        return getPrBody(
          {
            manager: 'some-manager',
            branchName: 'some-branch',
            baseBranch: 'base',
            upgrades: [],
            prBodyTemplate,
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
      }

      const defaultTemplate =
        '{{{header}}}{{{table}}}{{{warnings}}}{{{notes}}}{{{changelogs}}}{{{configDescription}}}{{{controls}}}{{{footer}}}';

      it('keeps the other sections when the notes are too long', () => {
        const res = getBody(defaultTemplate, {
          notes: advisory,
          changelogs: '',
        });

        expect(res.length).toBeLessThanOrEqual(2000);
        expect(res).toStartWith('getPrHeader');
        expect(res).toContain('Section was truncated to here');
        expect(res).toContain(
          'getPrConfigDescriptiongetControlsgetPrFooter\n<!--renovate-debug:',
        );
        expect(res).toEndWith('-->\n');
        // the cut advisory's `<details>` is closed before the notice
        expect(res.match(/<details>/g)).toHaveLength(1);
        expect(res.match(/<\/details>/g)).toHaveLength(1);
        expect(res.indexOf('</details>')).toBeLessThan(
          res.indexOf('Section was truncated to here'),
        );
      });

      it('cuts the changelogs before the notes', () => {
        const res = getBody(defaultTemplate, {
          notes: 'short notes',
          changelogs: changelog,
        });

        expect(res.length).toBeLessThanOrEqual(2000);
        expect(res).toContain('short notes');
        expect(res).toContain('<summary>dep</summary>');
        expect(res).toContain('Section was truncated to here');
        expect(res).toContain('getPrConfigDescriptiongetControlsgetPrFooter');
      });

      it('drops the changelogs when the notes use the whole budget', () => {
        const res = getBody(defaultTemplate, {
          notes: advisory,
          changelogs: changelog,
        });

        expect(res.length).toBeLessThanOrEqual(2000);
        expect(res).toContain('#### Details');
        expect(res).not.toContain('<summary>dep</summary>');
        expect(res).toContain('Section removed due to length limit');
        expect(res).toContain('getPrConfigDescriptiongetControlsgetPrFooter');
      });

      it('cuts by the length after the platform massaged the body', () => {
        const links = '[link](https://github.com/some/repo)\n\n'.repeat(40);
        function massage(body: string): string {
          return smartTruncate(
            body.replaceAll('github.com', 'redirect.github.com'),
            2000,
          );
        }

        const res = getBody(
          defaultTemplate,
          { notes: 'short notes', changelogs: links },
          massage,
        );

        // the body is shorter than the limit before the links are converted
        expect(links.length + 400).toBeLessThan(2000);
        expect(res.length).toBeLessThan(2000);
        expect(res).toContain('Section was truncated to here');
        expect(res).not.toContain('PR body was truncated');
        expect(res).toContain('redirect.github.com');
        expect(res).toContain('short notes');
        expect(res).toContain(
          'getPrConfigDescriptiongetControlsgetPrFooter\n<!--renovate-debug:',
        );
      });

      it('supports custom templates', () => {
        const res = getBody('{{{notes}}}\n\nCUSTOM{{{footer}}}', {
          notes: advisory,
          changelogs: changelog,
        });

        expect(res.length).toBeLessThanOrEqual(2000);
        expect(res).toContain('Section was truncated to here');
        expect(res).toContain('\n\nCUSTOMgetPrFooter\n<!--renovate-debug:');
      });

      it('does not cut a body which fits', () => {
        const res = getBody(defaultTemplate, {
          notes: 'short notes',
          changelogs: '',
        });

        expect(res).toContain('short notes');
        expect(res).not.toContain('truncated');
      });
    });
  });
});
