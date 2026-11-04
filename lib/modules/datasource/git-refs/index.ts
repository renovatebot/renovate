import { logger } from '../../../logger/index.ts';
import type { GetReleasesConfig, ReleaseResult } from '../types.ts';
import { GitDatasource } from './base.ts';

export class GitRefsDatasource extends GitDatasource {
  static override readonly id = 'git-refs';

  constructor() {
    super(GitRefsDatasource.id);
  }

  protected override readonly refTypes = ['tags', 'heads'];

  override supportsCustomRegistry(_packageName: string): boolean {
    return false;
  }

  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'The source URL is determined by using the `packageName` and `registryUrl`.';

  override getReleases(
    config: GetReleasesConfig,
  ): Promise<ReleaseResult | null> {
    return this.cached(
      {
        key: config.packageName,
        fallback: true,
      },
      async () => {
        try {
          return await this.getRefReleases(config);
        } catch (err) {
          logger.debug({ err }, 'Error getting git-refs');
          return null;
        }
      },
    );
  }
}
