import { logger } from '../../../logger/index.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import { isValidLocalPath, readLocalFile } from '../../../util/fs/index.ts';
import { HttpError } from '../../../util/http/index.ts';
import { isHttpUrl } from '../../../util/url.ts';
import { Datasource } from '../datasource.ts';
import { GithubTagsDatasource } from '../github-tags/index.ts';
import { GitlabTagsDatasource } from '../gitlab-tags/index.ts';
import type { GetReleasesConfig, ReleaseResult } from '../types.ts';
import { ProtoPlugin, ProtoPluginToml, resolvePluginConfig } from './schema.ts';

/**
 * Resolves a proto [TOML plugin](https://moonrepo.dev/docs/proto/non-wasm-plugin)
 * into releases. The `packageName` is the plugin locator from a `.prototools`
 * file: an `http(s)://` URL (fetched) or a repository-relative path from a
 * `file://` locator (read locally). The plugin's `[resolve] git-url` is looked
 * up via the github/gitlab tags datasource.
 */
export class ProtoPluginDatasource extends Datasource {
  static readonly id = 'proto-plugin';

  override readonly customRegistrySupport = false;
  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    "The source URL is the repository from the plugin's `[resolve] git-url`.";

  private readonly github = new GithubTagsDatasource();
  private readonly gitlab = new GitlabTagsDatasource();

  constructor() {
    super(ProtoPluginDatasource.id);
  }

  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    return withCache(
      {
        namespace: `datasource-${ProtoPluginDatasource.id}`,
        key: config.packageName,
        fallback: true,
      },
      () => this.getReleasesImpl(config.packageName),
    );
  }

  private async getReleasesImpl(
    locator: string,
  ): Promise<ReleaseResult | null> {
    const plugin = await this.loadPlugin(locator);
    if (!plugin) {
      return null;
    }

    const resolved = resolvePluginConfig(plugin);
    if (resolved.skipReason) {
      logger.debug({ locator }, 'proto-plugin: could not resolve a repository');
      return null;
    }

    // The `v`-prefix strip is applied by the manager's `extractVersion`; the
    // github/gitlab tags datasource already provides releases and `sourceUrl`.
    const { datasource, packageName, registryUrl } = resolved;
    const delegate =
      datasource === GitlabTagsDatasource.id ? this.gitlab : this.github;
    return delegate.getReleases({ packageName, registryUrl });
  }

  private async loadPlugin(locator: string): Promise<ProtoPlugin | null> {
    if (isHttpUrl(locator)) {
      try {
        const { body } = await this.http.getToml(locator, ProtoPlugin);
        return body;
      } catch (err) {
        // A missing plugin is a per-tool skip; host errors must propagate so
        // Renovate can retry rather than report "no releases".
        if (err instanceof HttpError && err.response?.statusCode === 404) {
          logger.debug({ locator }, 'proto-plugin: plugin not found');
          return null;
        }
        this.handleGenericErrors(err);
      }
    }

    // A `file://` locator is passed through as a repository-relative path.
    if (!isValidLocalPath(locator)) {
      logger.debug({ locator }, 'proto-plugin: plugin path outside repository');
      return null;
    }
    const content = await readLocalFile(locator, 'utf8');
    if (!content) {
      logger.debug({ locator }, 'proto-plugin: local plugin file not found');
      return null;
    }
    const parsed = ProtoPluginToml.safeParse(content);
    if (!parsed.success) {
      logger.debug(
        { err: parsed.error, locator },
        'proto-plugin: failed to parse local plugin',
      );
      return null;
    }
    return parsed.data;
  }
}
