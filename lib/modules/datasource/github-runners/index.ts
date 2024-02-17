import { id as dockerVersioningId } from '../../versioning/docker';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';

export class GithubRunnersDatasource extends Datasource {
  static readonly id = 'github-runners';

  /**
   * Only add stable runners to the datasource. See datasource readme for details.
   */
  private static readonly releases: Record<string, Release[] | undefined> = {
    ubuntu: [
      { version: '22.04' },
      { version: '20.04' },
      { version: '18.04', isDeprecated: true },
      { version: '16.04', isDeprecated: true },
    ],
    macos: [
      { version: '14', isStable: false },
      { version: '14-large', isStable: false },
      { version: '14-xlarge', isStable: false },
      { version: '13' },
      { version: '13-large' },
      { version: '13-xlarge' },
      { version: '12' },
      { version: '12-large' },
      { version: '11', isDeprecated: true },
      { version: '10.15', isDeprecated: true },
    ],
    windows: [
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
