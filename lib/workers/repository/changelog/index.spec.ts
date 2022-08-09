import { mockedFunction, partial } from '../../../../test/util';
import type { BranchUpgradeConfig } from '../../types';
import { getChangeLogJSON } from '../update/pr/changelog';
import { embedChangelogs, needsChangelogs } from '.';

jest.mock('../update/pr/changelog');

mockedFunction(getChangeLogJSON).mockResolvedValue({
  hasReleaseNotes: true,
});

describe('workers/repository/changelog/index', () => {
  it('embedChangelogs', async () => {
    const branches = [
      partial<BranchUpgradeConfig>({ logJSON: { hasReleaseNotes: false } }),
      partial<BranchUpgradeConfig>({}),
    ];
    await expect(embedChangelogs(branches)).toResolve();
    expect(branches).toEqual([
      { logJSON: { hasReleaseNotes: false } },
      { logJSON: { hasReleaseNotes: true } },
    ]);
  });

  it('needsChangelogs', () => {
    expect(needsChangelogs(partial<BranchUpgradeConfig>({}))).toBeFalse();
    expect(
      needsChangelogs(
        partial<BranchUpgradeConfig>({
          commitBody: '{{#if logJSON.hasReleaseNotes}}has changelog{{/if}}',
        })
      )
    ).toBeTrue();
  });
});
