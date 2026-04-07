import { partial } from '~test/util.ts';
import type { FetchChangeLogsOptions } from '../../../config/types.ts';
import type { BranchUpgradeConfig } from '../../types.ts';
import { getChangeLogJSON } from '../update/pr/changelog/index.ts';
import { embedChangelogs } from './index.ts';
import type { SupportedChangelogStages } from './types.ts';

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
    await expect(
      embedChangelogs({ branches, stage: 'pr', fetchChangeLogs: 'pr' }),
    ).toResolve();
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

  interface FetchChangeLogsTestCase {
    fetchChangeLogs?: FetchChangeLogsOptions;
    stage: SupportedChangelogStages;
    expectations: () => void;
  }

  const testCases: FetchChangeLogsTestCase[] = [
    {
      stage: 'pr',
      fetchChangeLogs: undefined, // should default to 'pr'
      expectations: () => {
        expect(getChangeLogJSON).toHaveBeenCalledTimes(2);
        expect(getChangeLogJSON).toHaveBeenCalledWith(
          expect.objectContaining({
            groupName: 'fetchChangeLogs is undefined',
          }),
        );
        expect(getChangeLogJSON).toHaveBeenCalledWith(
          expect.objectContaining({ groupName: 'fetchChangeLogs is pr' }),
        );
      },
    },
    {
      stage: 'pr',
      fetchChangeLogs: 'pr',
      expectations: () => {
        expect(getChangeLogJSON).toHaveBeenCalledTimes(2);
        expect(getChangeLogJSON).toHaveBeenCalledWith(
          expect.objectContaining({
            groupName: 'fetchChangeLogs is undefined',
          }),
        );
        expect(getChangeLogJSON).toHaveBeenCalledWith(
          expect.objectContaining({ groupName: 'fetchChangeLogs is pr' }),
        );
      },
    },
    {
      stage: 'pr',
      fetchChangeLogs: 'branch',
      expectations: () => {
        expect(getChangeLogJSON).toHaveBeenCalledTimes(1);
        expect(getChangeLogJSON).toHaveBeenCalledWith(
          expect.objectContaining({ groupName: 'fetchChangeLogs is pr' }),
        );
      },
    },
    {
      stage: 'pr',
      fetchChangeLogs: 'off',
      expectations: () => {
        expect(getChangeLogJSON).toHaveBeenCalledTimes(1);
        expect(getChangeLogJSON).toHaveBeenCalledWith(
          expect.objectContaining({ groupName: 'fetchChangeLogs is pr' }),
        );
      },
    },
    {
      stage: 'branch',
      fetchChangeLogs: undefined, // should default to 'pr'
      expectations: () => {
        expect(getChangeLogJSON).toHaveBeenCalledTimes(1);
        expect(getChangeLogJSON).toHaveBeenCalledWith(
          expect.objectContaining({ groupName: 'fetchChangeLogs is branch' }),
        );
      },
    },
    {
      stage: 'branch',
      fetchChangeLogs: 'branch',
      expectations: () => {
        expect(getChangeLogJSON).toHaveBeenCalledTimes(2);
        expect(getChangeLogJSON).toHaveBeenCalledWith(
          expect.objectContaining({
            groupName: 'fetchChangeLogs is undefined',
          }),
        );
        expect(getChangeLogJSON).toHaveBeenCalledWith(
          expect.objectContaining({ groupName: 'fetchChangeLogs is branch' }),
        );
      },
    },
    {
      stage: 'branch',
      fetchChangeLogs: 'pr',
      expectations: () => {
        expect(getChangeLogJSON).toHaveBeenCalledTimes(1);
        expect(getChangeLogJSON).toHaveBeenCalledWith(
          expect.objectContaining({ groupName: 'fetchChangeLogs is branch' }),
        );
      },
    },
    {
      stage: 'branch',
      fetchChangeLogs: 'off',
      expectations: () => {
        expect(getChangeLogJSON).toHaveBeenCalledTimes(1);
        expect(getChangeLogJSON).toHaveBeenCalledWith(
          expect.objectContaining({ groupName: 'fetchChangeLogs is branch' }),
        );
      },
    },
  ];

  test.each(testCases)(
    'stage is "$stage", top-level fetchChangeLogs is "$fetchChangeLogs"',
    async ({ fetchChangeLogs, stage, expectations }) => {
      vi.mocked(getChangeLogJSON).mockResolvedValue({
        hasReleaseNotes: true,
      });
      const branches = [
        partial<BranchUpgradeConfig>({
          groupName: 'fetchChangeLogs is undefined',
        }),
        partial<BranchUpgradeConfig>({
          groupName: 'fetchChangeLogs is pr',
          fetchChangeLogs: 'pr',
        }),
        partial<BranchUpgradeConfig>({
          groupName: 'fetchChangeLogs is branch',
          fetchChangeLogs: 'branch',
        }),
        partial<BranchUpgradeConfig>({
          groupName: 'fetchChangeLogs is off',
          fetchChangeLogs: 'off',
        }),
      ];
      await expect(
        embedChangelogs({
          branches,
          stage,
          fetchChangeLogs,
        }),
      ).toResolve();

      expectations();

      // When fetchChangeLogs is explicitly set to 'off', no changelogs should be fetched.
      expect(getChangeLogJSON).not.toHaveBeenCalledWith(
        expect.objectContaining({ groupName: 'fetchChangeLogs is off' }),
      );
    },
  );
});
