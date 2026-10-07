import { GitDatasource } from '../git-refs/base.ts';
import type { GetReleasesConfig, ReleaseResult } from '../types.ts';

export class GitTagsDatasource extends GitDatasource {
  static override readonly id = 'git-tags';

  constructor() {
    super(GitTagsDatasource.id);
  }

  protected override readonly refTypes = ['tags'];

  override supportsCustomRegistry(_packageName: string): boolean {
    return false;
  }

  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'The source URL is determined by using the `packageName` and `registryUrl`.';

  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    return this.cached(
      {
        key: config.packageName,
        fallback: true,
      },
      () => this.getRefReleases(config),
    );
  }
}
