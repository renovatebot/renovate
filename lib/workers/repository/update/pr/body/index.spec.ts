import { mocked, platform } from '../../../../../../test/util';
import * as _template from '../../../../../util/template';
import * as _changelogs from './changelogs';
import * as _configDescription from './config-description';
import * as _controls from './controls';
import * as _footer from './footer';
import * as _header from './header';
import * as _notes from './notes';
import * as _table from './updates-table';
import { getPrBody } from '.';

jest.mock('./changelogs');
const changelogs = mocked(_changelogs);

jest.mock('./config-description');
const configDescription = mocked(_configDescription);

jest.mock('./controls');
const controls = mocked(_controls);

jest.mock('./footer');
const footer = mocked(_footer);

jest.mock('./header');
const header = mocked(_header);

jest.mock('./notes');
const notes = mocked(_notes);

jest.mock('./updates-table');
const table = mocked(_table);

jest.mock('../../../../../util/template');
const template = mocked(_template);

describe('workers/repository/update/pr/body/index', () => {
  describe('getPrBody', () => {
    beforeEach(() => {
      changelogs.getChangelogs.mockReturnValueOnce('getChangelogs');
      configDescription.getPrConfigDescription.mockResolvedValueOnce(
        'getPrConfigDescription'
      );
      controls.getControls.mockResolvedValueOnce('getControls');
      footer.getPrFooter.mockReturnValueOnce('getPrFooter');
      header.getPrHeader.mockReturnValueOnce('getPrHeader');
      notes.getPrExtraNotes.mockReturnValueOnce('getPrExtraNotes');
      notes.getPrNotes.mockReturnValueOnce('getPrNotes');
      table.getPrUpdatesTable.mockReturnValueOnce('getPrUpdatesTable');
    });

    it('handles empty template', async () => {
      const res = await getPrBody({ branchName: 'some-branch', upgrades: [] });
      expect(res).toBeEmptyString();
    });

    it('massages upgrades', async () => {
      const upgrade = {
        branchName: 'some-branch',
        dependencyUrl: 'https://github.com/foo/bar',
        sourceUrl: 'https://github.com/foo/bar.git',
        sourceDirectory: '/baz',
        changelogUrl:
          'https://raw.githubusercontent.com/foo/bar/tree/main/CHANGELOG.md',
        homepage: 'https://example.com',
      };

      await getPrBody({ branchName: 'some-branch', upgrades: [upgrade] });

      expect(upgrade).toMatchObject({
        branchName: 'some-branch',
        changelogUrl:
          'https://raw.githubusercontent.com/foo/bar/tree/main/CHANGELOG.md',
        depNameLinked:
          '[undefined](https://example.com) ([source](https://github.com/foo/bar.git), [changelog](https://raw.githubusercontent.com/foo/bar/tree/main/CHANGELOG.md))',
        dependencyUrl: 'https://github.com/foo/bar',
        homepage: 'https://example.com',
        references:
          '[homepage](https://example.com), [source](https://github.com/foo/bar.git/tree/HEAD//baz), [changelog](https://raw.githubusercontent.com/foo/bar/tree/main/CHANGELOG.md)',
        sourceDirectory: '/baz',
        sourceUrl: 'https://github.com/foo/bar.git',
      });
    });

    it('uses dependencyUrl as primary link', async () => {
      const upgrade = {
        branchName: 'some-branch',
        dependencyUrl: 'https://github.com/foo/bar',
      };

      await getPrBody({ branchName: 'some-branch', upgrades: [upgrade] });

      expect(upgrade).toMatchObject({
        branchName: 'some-branch',
        depNameLinked: '[undefined](https://github.com/foo/bar)',
        dependencyUrl: 'https://github.com/foo/bar',
        references: '',
      });
    });

    it('compiles template', async () => {
      platform.massageMarkdown.mockImplementation((x) => x);
      template.compile.mockImplementation((x) => x);
      const res = await getPrBody({
        branchName: 'some-branch',
        upgrades: [],
        prBodyTemplate: 'PR BODY',
      });
      expect(res).toBe('PR BODY');
    });

    it('supports extra string appending', async () => {
      platform.massageMarkdown.mockImplementation((x) => x);
      template.compile.mockImplementation((x) => x);
      const res = await getPrBody(
        {
          branchName: 'some-branch',
          upgrades: [],
          prBodyTemplate: 'PR BODY',
        },
        { appendExtra: '+EXTRA' }
      );
      expect(res).toBe('PR BODY+EXTRA');
    });

    it('supports custom rebasing message', async () => {
      platform.massageMarkdown.mockImplementation((x) => x);
      template.compile.mockImplementation((x) => x);
      const res = await getPrBody(
        {
          branchName: 'some-branch',
          upgrades: [],
          prBodyTemplate: ['aaa', '**Rebasing**: FOO', 'bbb'].join('\n'),
        },
        { rebasingNotice: 'BAR' }
      );
      expect(res).toContain(['aaa', '**Rebasing**: BAR', 'bbb'].join('\n'));
    });
  });
});
