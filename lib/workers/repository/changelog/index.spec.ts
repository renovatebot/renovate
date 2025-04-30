import type { BranchUpgradeConfig } from '../../types';
import { getChangeLogJSON } from '../update/pr/changelog';
import { embedChangelogs } from '.';
import { partial } from '~test/util';

vi.mock('../update/pr/changelog');

vi.mocked(getChangeLogJSON).mockResolvedValue({
  hasReleaseNotes: true,
});

describe('workers/repository/changelog/index', () => {
  it('embedChangelogs', async () => {
    vi.mocked(getChangeLogJSON).mockResolvedValueOnce({
      hasReleaseNotes: true,
    });
    vi.mocked(getChangeLogJSON).mockResolvedValueOnce(null);
    const branches = [
      partial<BranchUpgradeConfig>({ logJSON: null }),
      partial<BranchUpgradeConfig>(),
      partial<BranchUpgradeConfig>(),
    ];
    await expect(embedChangelogs(branches)).toResolve();
    expect(branches).toEqual([
      { logJSON: null },
      { logJSON: { hasReleaseNotes: true } },
      { logJSON: null },
    ]);
  });
});
