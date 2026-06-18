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
    const upgrades = [
      partial<BranchUpgradeConfig>({ fetchChangeLogs: 'pr', logJSON: null }),
      partial<BranchUpgradeConfig>({ fetchChangeLogs: 'pr' }),
      partial<BranchUpgradeConfig>({ fetchChangeLogs: 'pr' }),
      partial<BranchUpgradeConfig>({
        fetchChangeLogs: 'pr',
        changelogContent: 'testContent',
      }),
    ];
    await expect(
      embedChangelogs({
        upgrades,
        stage: 'pr',
      }),
    ).toResolve();
    expect(upgrades).toEqual([
      { fetchChangeLogs: 'pr', logJSON: null },
      { fetchChangeLogs: 'pr', logJSON: { hasReleaseNotes: true } },
      { fetchChangeLogs: 'pr', logJSON: null },
      {
        fetchChangeLogs: 'pr',
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

  it('only fetches changelogs for upgrades whose fetchChangeLogs matches the stage name', async () => {
    const freshUpgrades = (): BranchUpgradeConfig[] => [
      {
        branchName: 'foo',
        manager: 'bar',
        groupName: 'fetchChangeLogs is pr',
        fetchChangeLogs: 'pr',
      },
      {
        branchName: 'foo2',
        manager: 'bar',
        groupName: 'fetchChangeLogs is branch',
        fetchChangeLogs: 'branch',
      },
      {
        branchName: 'foo3',
        manager: 'bar',
        groupName: 'fetchChangeLogs is off',
        fetchChangeLogs: 'off',
      },
    ];

    await expect(
      embedChangelogs({
        upgrades: freshUpgrades(),
        stage: 'branch',
      }),
    ).toResolve();

    expect(getChangeLogJSON).toHaveBeenCalledTimes(1);
    expect(getChangeLogJSON).toHaveBeenCalledWith(
      expect.objectContaining({ groupName: 'fetchChangeLogs is branch' }),
    );

    // When fetchChangeLogs is explicitly set to 'off', no changelogs should be fetched.
    expect(getChangeLogJSON).not.toHaveBeenCalledWith(
      expect.objectContaining({ groupName: 'fetchChangeLogs is off' }),
    );

    vitest.mocked(getChangeLogJSON).mockClear();
    await expect(
      embedChangelogs({
        upgrades: freshUpgrades(),
        stage: 'pr',
      }),
    ).toResolve();

    expect(getChangeLogJSON).toHaveBeenCalledTimes(1);
    expect(getChangeLogJSON).toHaveBeenCalledWith(
      expect.objectContaining({ groupName: 'fetchChangeLogs is pr' }),
    );

    // When fetchChangeLogs is explicitly set to 'off', no changelogs should be fetched.
    expect(getChangeLogJSON).not.toHaveBeenCalledWith(
      expect.objectContaining({ groupName: 'fetchChangeLogs is off' }),
    );
  });
});
