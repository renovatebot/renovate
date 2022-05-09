import { mocked } from '../../../../../../test/util';
import * as _template from '../../../../../util/template';
import { getChangelogs } from './changelogs';

jest.mock('../../../../../util/template');
const template = mocked(_template);

describe('workers/repository/update/pr/body/changelogs', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns empty string when there is no release notes', () => {
    const res = getChangelogs({
      branchName: 'some-branch',
      upgrades: [],
      hasReleaseNotes: false,
    });

    expect(res).toBe('');
    expect(template.compile).not.toHaveBeenCalled();
  });

  it('returns release notes', () => {
    template.compile.mockImplementationOnce((_, config): string => {
      const upgrades: { releaseNotesSummaryTitle: string }[] =
        config.upgrades as never;
      return upgrades
        .map((upgrade) => upgrade.releaseNotesSummaryTitle)
        .join('\n')
        .trim();
    });

    const res = getChangelogs({
      branchName: 'some-branch',
      upgrades: [
        {
          depName: 'dep-1',
          repoName: 'some/repo',
          branchName: 'some-branch',
          hasReleaseNotes: true,
        },
        {
          depName: 'dep-2',
          repoName: 'some/repo',
          branchName: 'some-branch',
          hasReleaseNotes: true,
        },
        {
          depName: 'dep-3',
          repoName: 'some/repo',
          branchName: 'some-branch',
          hasReleaseNotes: true,
        },
        {
          depName: 'dep-4',
          repoName: 'other/repo',
          branchName: 'some-branch',
          hasReleaseNotes: true,
        },
      ],
      hasReleaseNotes: true,
    });

    expect(res).toMatchInlineSnapshot(`
      "

      ---

      some/repo (dep-1)
      some/repo (dep-2)
      some/repo (dep-3)
      other/repo

      "
    `);
  });
});
