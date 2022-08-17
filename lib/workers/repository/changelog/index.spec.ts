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
    mockedFunction(getChangeLogJSON).mockResolvedValueOnce({
      hasReleaseNotes: true,
    });
    mockedFunction(getChangeLogJSON).mockResolvedValueOnce(null);
    const branches = [
      partial<BranchUpgradeConfig>({ logJSON: null }),
      partial<BranchUpgradeConfig>({}),
      partial<BranchUpgradeConfig>({}),
    ];
    await expect(embedChangelogs(branches)).toResolve();
    expect(branches).toEqual([
      { logJSON: null },
      { logJSON: { hasReleaseNotes: true } },
      { logJSON: null },
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
    ).toBeFalse();
    expect(
      needsChangelogs(
        partial<BranchUpgradeConfig>({
          commitBody: '{{#if logJSON.hasReleaseNotes}}has changelog{{/if}}',
        }),
        ['commitBody']
      )
    ).toBeTrue();
  });
});
