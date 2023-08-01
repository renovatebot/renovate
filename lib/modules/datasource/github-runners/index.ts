import { id as dockerVersioningId } from '../../versioning/docker';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';

export class GithubRunnersDatasource extends Datasource {
  static readonly id = 'github-runners';

  /**
   * Only add stable runners to the datasource. See datasource readme for details.
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
