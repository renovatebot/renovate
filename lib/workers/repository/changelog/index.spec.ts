import { partial } from '~test/util.ts';
import type { BranchUpgradeConfig } from '../../types.ts';
import { getChangeLogJSON } from '../update/pr/changelog/index.ts';
import { embedChangelogs } from './index.ts';

vi.mock('../update/pr/changelog/index.ts');

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
      partial<BranchUpgradeConfig>({ changelogContent: 'testContent' }),
    ];
    await expect(embedChangelogs(branches)).toResolve();
    expect(branches).toEqual([
      { logJSON: null },
      { logJSON: { hasReleaseNotes: true } },
      { logJSON: null },
      {
        changelogContent: 'testContent',
        logJSON: {
          hasReleaseNotes: true,
          project: {},
          versions: [
            {
              releaseNotes: {
                body: 'testContent',
              },
            },
          ],
        },
      },
    ]);
  });
});
