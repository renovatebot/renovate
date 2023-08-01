import { id as dockerVersioningId } from '../../versioning/docker';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';

export class GithubRunnersDatasource extends Datasource {
  static readonly id = 'github-runners';

  /**
   * List of all available GitHub-hosted runners.
   * Single source of truth: https://github.com/actions/runner-images
   *
   * Please don't add runners until they are out of beta state and have the label "latest" assigned.
   */
  private static readonly releases: { [packageName: string]: Release[] } = {
    ubuntu: [{ version: '22.04' }, { version: '20.04' }],
    macos: [
      { version: '13' },
      { version: '13-xl' },
      { version: '12' },
      { version: '12-xl' },
      { version: '11' },
    ],
    windows: [{ version: '2022' }, { version: '2019' }],
  };

  override readonly defaultVersioning = dockerVersioningId;

  constructor() {
    super(GithubRunnersDatasource.id);
  }

  override getReleases({
    packageName,
  }: GetReleasesConfig): Promise<ReleaseResult> {
    const releaseResult: ReleaseResult = {
      releases: GithubRunnersDatasource.releases[packageName] || [],
      sourceUrl: 'https://github.com/actions/runner-images',
    };

    return Promise.resolve(releaseResult);
  }
}
