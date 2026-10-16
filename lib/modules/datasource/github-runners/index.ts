import { Timestamp } from '../../../util/timestamp.ts';
import { id as dockerVersioningId } from '../../versioning/docker/index.ts';
import { Datasource } from '../datasource.ts';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types.ts';

export class GithubRunnersDatasource extends Datasource {
  static readonly id = 'github-runners';

  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'We use the URL: https://github.com/actions/runner-images.';

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    "The release timestamp is manually specified in Renovate's code, based on the date GitHub announced the runner image as generally available on [their changelog](https://github.blog/changelog/label/actions/)";

  /**
   * Unstable runners must have the `isStable: false` property.
   * Deprecated runners must have the `isDeprecated: true` property.
   * Stable runners should have no extra properties.
   * For more details, read the github-runners datasource readme.
   * Check https://github.blog/changelog/label/actions/ for stable and deprecation dates.
   */
  private static readonly releases: Record<string, Release[] | undefined> = {
    ubuntu: [
      { version: '26.04', releaseTimestamp: Timestamp.parse('2026-09-17') },
      {
        version: '26.04-arm',
        releaseTimestamp: Timestamp.parse('2026-09-17'),
      },
      { version: '24.04', releaseTimestamp: Timestamp.parse('2024-09-25') },
      {
        version: '24.04-arm',
        releaseTimestamp: Timestamp.parse('2024-09-25'),
      },
      { version: '22.04', releaseTimestamp: Timestamp.parse('2022-08-09') },
      {
        version: '22.04-arm',
        releaseTimestamp: Timestamp.parse('2022-08-09'),
      },
      {
        version: '20.04',
        isDeprecated: true,
        releaseTimestamp: Timestamp.parse('2020-10-29'),
      },
      {
        version: '18.04',
        isDeprecated: true,
        releaseTimestamp: Timestamp.parse('2019-11-13'),
      },
      {
        version: '16.04',
        isDeprecated: true,
        releaseTimestamp: Timestamp.parse('2019-08-08'),
      },
    ],
    macos: [
      { version: '26', releaseTimestamp: Timestamp.parse('2026-02-26') },
      {
        version: '26-intel',
        releaseTimestamp: Timestamp.parse('2026-02-26'),
      },
      {
        version: '26-xlarge',
        releaseTimestamp: Timestamp.parse('2026-02-26'),
      },
      { version: '15', releaseTimestamp: Timestamp.parse('2025-04-10') },
      { version: '15-intel', releaseTimestamp: Timestamp.parse('2025-04-10') },
      { version: '15-large', releaseTimestamp: Timestamp.parse('2025-04-10') },
      {
        version: '15-xlarge',
        releaseTimestamp: Timestamp.parse('2025-04-10'),
      },
      { version: '14', releaseTimestamp: Timestamp.parse('2024-04-01') },
      { version: '14-large', releaseTimestamp: Timestamp.parse('2024-04-01') },
      {
        version: '14-xlarge',
        releaseTimestamp: Timestamp.parse('2024-04-01'),
      },
      {
        version: '13',
        isDeprecated: true,
        releaseTimestamp: Timestamp.parse('2024-01-30'),
      },
      {
        version: '13-large',
        isDeprecated: true,
        releaseTimestamp: Timestamp.parse('2024-01-30'),
      },
      {
        version: '13-xlarge',
        isDeprecated: true,
        releaseTimestamp: Timestamp.parse('2024-01-30'),
      },
      {
        version: '12-large',
        isDeprecated: true,
        releaseTimestamp: Timestamp.parse('2022-06-13'),
      },
      {
        version: '12',
        isDeprecated: true,
        releaseTimestamp: Timestamp.parse('2022-06-13'),
      },
      {
        version: '11',
        isDeprecated: true,
        releaseTimestamp: Timestamp.parse('2021-08-16'),
      },
      {
        version: '10.15',
        isDeprecated: true,
        releaseTimestamp: Timestamp.parse('2019-11-04'),
      },
    ],
    windows: [
      { version: '2025', releaseTimestamp: Timestamp.parse('2025-04-10') },
      { version: '2022', releaseTimestamp: Timestamp.parse('2021-11-15') },
      { version: '11-arm', releaseTimestamp: Timestamp.parse('2025-08-07') },
      {
        version: '2019',
        isDeprecated: true,
        releaseTimestamp: Timestamp.parse('2019-11-13'),
      },
      {
        version: '2016',
        isDeprecated: true,
        releaseTimestamp: Timestamp.parse('2019-08-08'),
      },
    ],
  };

  public static isValidRunner(
    runnerName: string,
    runnerVersion: string,
  ): boolean {
    const runnerReleases = GithubRunnersDatasource.releases[runnerName];
    if (!runnerReleases) {
      return false;
    }

    const versionExists = runnerReleases.some(
      ({ version }) => version === runnerVersion,
    );

    return runnerVersion === 'latest' || versionExists;
  }

  override readonly defaultVersioning = dockerVersioningId;

  constructor() {
    super(GithubRunnersDatasource.id);
  }

  override getReleases({
    packageName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const releases = GithubRunnersDatasource.releases[packageName];
    const releaseResult: ReleaseResult | null = releases
      ? {
          releases,
          sourceUrl: 'https://github.com/actions/runner-images',
        }
      : null;
    return Promise.resolve(releaseResult);
  }
}
