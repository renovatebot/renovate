import type { z } from 'zod/v4';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import { joinUrlParts } from '../../../util/url.ts';
import { Datasource } from '../datasource.ts';
import type { GetReleasesConfig, ReleaseResult } from '../types.ts';
import { GetLatestCuratedPluginResponse } from './schema.ts';

export class BufPluginDatasource extends Datasource {
  static readonly id = 'buf-plugin';

  constructor() {
    super(BufPluginDatasource.id);
  }

  override readonly defaultRegistryUrls = ['https://buf.build'];

  override readonly defaultVersioning = 'semver-coerced';

  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'The source URL is determined from the `sourceUrl` field returned by the Buf Schema Registry.';

  private async _getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const [owner, name] = packageName.split('/');
    /* v8 ignore next -- should never happen */
    if (!owner || !name) {
      return null;
    }

    /* v8 ignore next -- should never happen */
    if (!registryUrl) {
      return null;
    }

    const url = joinUrlParts(
      registryUrl,
      'buf.alpha.registry.v1alpha1.PluginCurationService/GetLatestCuratedPlugin',
    );

    let body: z.infer<typeof GetLatestCuratedPluginResponse>;
    try {
      body = (
        await this.http.postJson(
          url,
          { body: { owner, name } },
          GetLatestCuratedPluginResponse,
        )
      ).body;
    } catch (err) {
      this.handleGenericErrors(err);
    }

    const { plugin, versions } = body;

    return {
      sourceUrl: plugin.sourceUrl,
      homepage: joinUrlParts(registryUrl, owner, name),
      tags: { latest: plugin.version },
      releases: versions.map(({ version }) => ({
        version,
        isDeprecated: plugin.deprecated && version === plugin.version,
      })),
    };
  }

  override getReleases(
    config: GetReleasesConfig,
  ): Promise<ReleaseResult | null> {
    return withCache(
      {
        namespace: `datasource-${BufPluginDatasource.id}`,
        key: `${config.registryUrl}:${config.packageName}`,
        cacheable: config.registryUrl === this.defaultRegistryUrls[0],
        fallback: true,
      },
      () => this._getReleases(config),
    );
  }
}
