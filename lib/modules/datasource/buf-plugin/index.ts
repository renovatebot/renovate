import type { z } from 'zod/v4';
import { buildCacheKey } from '../../../util/cache/package/key.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import { joinUrlParts } from '../../../util/url.ts';
import { Datasource } from '../datasource.ts';
import type { GetReleasesConfig, ReleaseResult } from '../types.ts';
import { GetLatestCuratedPluginResponse } from './schema.ts';

const defaultRegistryUrl = 'https://buf.build';

export class BufPluginDatasource extends Datasource {
  static readonly id = 'buf-plugin';

  constructor() {
    super(BufPluginDatasource.id);
  }

  override getDefaultRegistryUrls(_packageName: string): string[] {
    return [defaultRegistryUrl];
  }

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
        key: buildCacheKey(config.registryUrl, config.packageName),
        cacheable: config.registryUrl === defaultRegistryUrl,
        fallback: true,
      },
      () => this._getReleases(config),
    );
  }
}
