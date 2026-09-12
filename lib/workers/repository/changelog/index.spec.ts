import { partial } from '~test/util.ts';
import type { Timestamp } from '../../../util/timestamp.ts';
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
          perDependencyNotes: true,
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
    function freshUpgrades(): BranchUpgradeConfig[] {
      return [
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
    }

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

  it('embeds every release with content in the update range newest-first', async () => {
    const upgrades = [
      partial<BranchUpgradeConfig>({
        branchName: 'update/example',
        changelogContent: 'targetContent',
        changelogReleases: [
          {
            changelogContent: 'oldContent',
            changelogUrl: 'https://example.com/releases/0.9.0',
            version: '0.9.0',
          },
          {
            changelogContent: 'currentContent',
            changelogUrl: 'https://example.com/releases/1.0.0',
            version: '1.0.0',
          },
          {
            changelogContent: 'intermediateContent',
            changelogUrl: 'https://example.com/releases/1.1.0',
            gitRef: 'release-1.1.0',
            releaseTimestamp: '2026-01-02T00:00:00.000Z' as Timestamp,
            version: '1.1.0',
          },
          {
            changelogContent: 'prereleaseContent',
            version: '1.2.1-rc.1',
          },
          {
            changelogContent: 'targetContent',
            changelogUrl: 'https://example.com/releases/1.3.0',
            releaseTimestamp: '2026-01-04T00:00:00.000Z' as Timestamp,
            version: '1.3.0',
          },
          {
            changelogContent: 'futureContent',
            changelogUrl: 'https://example.com/releases/1.4.0',
            version: '1.4.0',
          },
        ],
        currentVersion: '1.0.0',
        depName: 'example',
        fetchChangeLogs: 'pr',
        newVersion: '1.3.0',
        packageName: 'example',
        versioning: 'npm',
      }),
    ];

    await embedChangelogs({ upgrades, stage: 'pr' });

    expect(getChangeLogJSON).not.toHaveBeenCalled();
    expect(upgrades[0].logJSON).toEqual({
      hasReleaseNotes: true,
      perDependencyNotes: true,
      project: {
        apiBaseUrl: undefined,
        baseUrl: undefined,
        depName: 'example',
        packageName: 'example',
        repository: undefined,
        sourceDirectory: undefined,
        sourceUrl: undefined,
        type: undefined,
      },
      versions: [
        {
          changes: [],
          compare: {},
          date: '2026-01-04T00:00:00.000Z',
          gitRef: undefined,
          releaseNotes: {
            body: 'targetContent',
            notesSourceUrl: undefined,
            url: 'https://example.com/releases/1.3.0',
          },
          version: '1.3.0',
        },
        {
          changes: [],
          compare: {},
          date: '2026-01-02T00:00:00.000Z',
          gitRef: 'release-1.1.0',
          releaseNotes: {
            body: 'intermediateContent',
            notesSourceUrl: undefined,
            url: 'https://example.com/releases/1.1.0',
          },
          version: '1.1.0',
        },
      ],
    });
  });

  it('uses intermediate content when the target release has no content', async () => {
    const upgrades = [
      partial<BranchUpgradeConfig>({
        changelogReleases: [
          {
            changelogContent: 'intermediateContent',
            changelogUrl: 'https://example.com/releases/1.1.0',
            version: '1.1.0',
          },
        ],
        currentVersion: '1.0.0',
        fetchChangeLogs: 'pr',
        newVersion: '1.2.0',
        versioning: 'npm',
      }),
    ];

    await embedChangelogs({ upgrades, stage: 'pr' });

    expect(getChangeLogJSON).not.toHaveBeenCalled();
    expect(upgrades[0].logJSON?.versions).toEqual([
      expect.objectContaining({
        releaseNotes: {
          body: 'intermediateContent',
          notesSourceUrl: undefined,
          url: 'https://example.com/releases/1.1.0',
        },
        version: '1.1.0',
      }),
    ]);
  });

  it('normalizes versions and excludes incompatible release content', async () => {
    const upgrades = [
      partial<BranchUpgradeConfig>({
        changelogReleases: [
          {
            changelogContent: 'alpineContent',
            version: '1.0.1-alpine',
          },
          {
            changelogContent: 'bookwormContent',
            version: '1.0.2-bookworm',
          },
          {
            changelogContent: 'targetContent',
            version: '1.0.3-alpine',
          },
        ],
        currentValue: '1.0.0-alpine',
        currentVersion: '1.0.0',
        fetchChangeLogs: 'pr',
        newVersion: '1.0.3',
        versioning: 'docker',
      }),
    ];

    await embedChangelogs({ upgrades, stage: 'pr' });

    expect(upgrades[0].logJSON?.versions).toEqual([
      expect.objectContaining({
        releaseNotes: expect.objectContaining({ body: 'targetContent' }),
        version: '1.0.3',
      }),
      expect.objectContaining({
        releaseNotes: expect.objectContaining({ body: 'alpineContent' }),
        version: '1.0.1',
      }),
    ]);
  });

  it('filters release content independently for each update target', async () => {
    const changelogReleases = [
      { changelogContent: 'oneOne', version: '1.1.0' },
      { changelogContent: 'oneTwo', version: '1.2.0' },
      { changelogContent: 'twoZero', version: '2.0.0' },
    ];
    const upgrades = [
      partial<BranchUpgradeConfig>({
        changelogReleases,
        currentVersion: '1.0.0',
        fetchChangeLogs: 'pr',
        newVersion: '1.2.0',
        versioning: 'npm',
      }),
      partial<BranchUpgradeConfig>({
        changelogReleases,
        currentVersion: '1.0.0',
        fetchChangeLogs: 'pr',
        newVersion: '2.0.0',
        versioning: 'npm',
      }),
    ];

    await embedChangelogs({ upgrades, stage: 'pr' });

    expect(
      upgrades[0].logJSON?.versions?.map(({ version }) => version),
    ).toEqual(['1.2.0', '1.1.0']);
    expect(
      upgrades[1].logJSON?.versions?.map(({ version }) => version),
    ).toEqual(['2.0.0', '1.2.0', '1.1.0']);
  });

  it('falls back to the normal changelog lookup when no content is in range', async () => {
    const expected = { hasReleaseNotes: true };
    vi.mocked(getChangeLogJSON).mockResolvedValueOnce(expected);
    const upgrades = [
      partial<BranchUpgradeConfig>({
        changelogReleases: [
          { changelogContent: 'oldContent', version: '0.9.0' },
          { changelogContent: 'futureContent', version: '2.0.0' },
        ],
        currentVersion: '1.0.0',
        fetchChangeLogs: 'pr',
        newVersion: '1.1.0',
        versioning: 'npm',
      }),
    ];

    await embedChangelogs({ upgrades, stage: 'pr' });

    expect(getChangeLogJSON).toHaveBeenCalledExactlyOnceWith(upgrades[0]);
    expect(upgrades[0].logJSON).toBe(expected);
  });

  it('deduplicates versions which are equal under the configured versioning', async () => {
    const upgrades = [
      partial<BranchUpgradeConfig>({
        changelogReleases: [
          { changelogContent: 'releaseContent', version: '1.1.0' },
          { changelogContent: 'releaseContent', version: 'v1.1.0' },
        ],
        currentVersion: '1.0.0',
        fetchChangeLogs: 'pr',
        newVersion: '1.1.0',
        versioning: 'npm',
      }),
    ];

    await embedChangelogs({ upgrades, stage: 'pr' });

    expect(upgrades[0].logJSON?.versions).toHaveLength(1);
  });

  it.each`
    missing             | upgrade
    ${'versioning'}     | ${{ currentVersion: '1.0.0', newVersion: '1.1.0' }}
    ${'currentVersion'} | ${{ newVersion: '1.1.0', versioning: 'npm' }}
    ${'newVersion'}     | ${{ currentVersion: '1.0.0', versioning: 'npm' }}
  `(
    'uses the single-release fallback when $missing is missing',
    async ({ upgrade }) => {
      const upgrades = [
        partial<BranchUpgradeConfig>({
          ...upgrade,
          changelogContent: 'fallbackContent',
          changelogReleases: [
            { changelogContent: 'releaseContent', version: '1.1.0' },
          ],
          fetchChangeLogs: 'pr',
        }),
      ];

      await embedChangelogs({ upgrades, stage: 'pr' });

      expect(upgrades[0].logJSON?.versions?.[0].releaseNotes?.body).toBe(
        'fallbackContent',
      );
      expect(getChangeLogJSON).not.toHaveBeenCalled();
    },
  );
});
