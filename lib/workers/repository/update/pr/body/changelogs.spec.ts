import * as _template from '../../../../../util/template/index.ts';
import type { BranchConfig } from '../../../../types.ts';
import {
  getChangelogs,
  getChangelogsCommentContent,
  getChangelogsCommentNotice,
} from './changelogs.ts';

vi.mock('../../../../../util/template/index.ts');
const template = vi.mocked(_template);

describe('workers/repository/update/pr/body/changelogs', () => {
  it('returns empty string when there is no release notes', () => {
    const res = getChangelogs({
      manager: 'some-manager',
      branchName: 'some-branch',
      baseBranch: 'base',
      upgrades: [],
      hasReleaseNotes: false,
    });

    expect(res).toBe('');
    expect(template.compile).not.toHaveBeenCalled();
  });

  it('returns release notes', () => {
    template.compile.mockImplementationOnce((_, config): string => {
      // ts can't infere correct type here
      const { upgrades } = config as BranchConfig;
      return upgrades
        .map((upgrade) => upgrade.releaseNotesSummaryTitle)
        .join('\n')
        .trim();
    });

    const res = getChangelogs({
      branchName: 'some-branch',
      baseBranch: 'base',
      manager: 'some-manager',
      upgrades: [
        {
          manager: 'some-manager',
          depName: 'dep-1',
          repoName: 'some/repo',
          branchName: 'some-branch',
          hasReleaseNotes: true,
        },
        {
          manager: 'some-manager',
          depName: 'dep-2',
          repoName: 'some/repo',
          branchName: 'some-branch',
          hasReleaseNotes: true,
        },
        {
          manager: 'some-manager',
          depName: 'dep-3',
          repoName: 'some/repo',
          branchName: 'some-branch',
          hasReleaseNotes: true,
        },
        {
          manager: 'some-manager',
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
      other/repo (dep-4)

      "
    `);
  });

  describe('getChangelogsCommentNotice', () => {
    it('returns empty string when there is no release notes', () => {
      const res = getChangelogsCommentNotice({
        manager: 'some-manager',
        branchName: 'some-branch',
        baseBranch: 'base',
        upgrades: [],
        hasReleaseNotes: false,
      });

      expect(res).toBe('');
    });

    it('returns a notice pointing to the comment', () => {
      const res = getChangelogsCommentNotice({
        manager: 'some-manager',
        branchName: 'some-branch',
        baseBranch: 'base',
        upgrades: [],
        hasReleaseNotes: true,
      });

      expect(res).toMatchInlineSnapshot(`
        "

        ---

        Release notes for this update are in a comment on this PR.

        "
      `);
    });
  });
  describe('getChangelogsCommentContent', () => {
    it('returns empty string when there is no release notes', () => {
      const res = getChangelogsCommentContent({
        manager: 'some-manager',
        branchName: 'some-branch',
        baseBranch: 'base',
        upgrades: [],
        hasReleaseNotes: false,
      });

      expect(res).toBe('');
      expect(template.compile).not.toHaveBeenCalled();
    });

    it('drops the heading which the comment topic already provides', () => {
      template.compile.mockImplementationOnce(
        (): string => '### Release Notes\n\nsome/repo (dep-1)',
      );

      const res = getChangelogsCommentContent({
        manager: 'some-manager',
        branchName: 'some-branch',
        baseBranch: 'base',
        upgrades: [
          {
            manager: 'some-manager',
            depName: 'dep-1',
            repoName: 'some/repo',
            branchName: 'some-branch',
            hasReleaseNotes: true,
          },
        ],
        hasReleaseNotes: true,
      });

      expect(res).toBe('some/repo (dep-1)');
    });
  });
});
