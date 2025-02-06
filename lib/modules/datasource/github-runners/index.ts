import { id as dockerVersioningId } from '../../versioning/docker';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';

export class GithubRunnersDatasource extends Datasource {
  static readonly id = 'github-runners';

  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'We use the URL: https://github.com/actions/runner-images.';

  /**
   * Unstable runners must have the `isStable: false` property.
   * Deprecated runners must have the `isDeprecated: true` property.
   * Stable runners should have no extra properties.
   * For more details, read the github-runners datasource readme.
   * Check https://github.blog/changelog/label/actions/ for stable and deprecation dates.
   */
  private static readonly releases: Record<string, Release[] | undefined> = {
    ubuntu: [
      { version: '24.04' },
      { version: '24.04-arm', isStable: false },
      { version: '22.04' },
      { version: '22.04-arm', isStable: false },
      { version: '20.04', isDeprecated: true },
      { version: '18.04', isDeprecated: true },
      { version: '16.04', isDeprecated: true },
    ],
    macos: [
      { version: '15', isStable: false },
      { version: '15-large', isStable: false },
      { version: '15-xlarge', isStable: false },
      { version: '14' },
      { version: '14-large' },
      { version: '14-xlarge' },
      { version: '13' },
      { version: '13-large' },
      { version: '13-xlarge' },
      { version: '12-large', isDeprecated: true },
      { version: '12', isDeprecated: true },
      { version: '11', isDeprecated: true },
      { version: '10.15', isDeprecated: true },
    ],
    windows: [
      { version: '2025', isStable: false },
      { version: '2022' },
      { version: '2019' },
      { version: '2016', isDeprecated: true },
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
