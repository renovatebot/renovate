import { logger } from '../../../logger';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import { cache } from '../../../util/cache/package/decorator';
import { HttpError } from '../../../util/http';
import { isVersion, id as semverId } from '../../versioning/semver';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';

export class DevboxVersionDatasource extends Datasource {
  static readonly id = 'devbox-version';

  constructor() {
    super(DevboxVersionDatasource.id);
  }

  override readonly defaultRegistryUrls = [
    'https://releases.jetify.com/devbox/stable/',
  ];

  override readonly customRegistrySupport = false;

  override readonly defaultVersioning = semverId;

  override readonly releaseTimestampSupport = false;
  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'We use the URL: https://github.com/jetify-com/devbox.';

  @cache({ namespace: `datasource-${DevboxVersionDatasource.id}`, key: 'all' })
  async getReleases({
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const res: ReleaseResult = {
      homepage: 'https://www.jetify.com/devbox',
      sourceUrl: 'https://github.com/jetify-com/devbox',
      releases: [],
    };

    const devboxVersionUrl = `${registryUrl}version`;

    try {
      logger.trace({ registryUrl }, 'fetching devbox version');
      const response = await this.http.getText(devboxVersionUrl);
      const version = response.body.trim();

      if (!isVersion(version)) {
        logger.warn({ version }, 'Invalid devbox version received');
        return null;
      }

      res.releases.push({ version });
    } catch (err) {
      if (err instanceof HttpError) {
        if (err.response?.statusCode !== 404) {
          throw new ExternalHostError(err);
        }
      }
      this.handleGenericErrors(err);
    }

    return res;
  }
}
