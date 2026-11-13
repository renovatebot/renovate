import { logger } from '../../../logger/index.ts';
import { detectPlatform } from '../../../util/common.ts';
import { isValidLocalPath, readLocalFile } from '../../../util/fs/index.ts';
import { parseGitUrl } from '../../../util/git/url.ts';
import { HttpError } from '../../../util/http/index.ts';
import { isHttpUrl } from '../../../util/url.ts';
import { Datasource } from '../datasource.ts';
import { GitTagsDatasource } from '../git-tags/index.ts';
import { GithubTagsDatasource } from '../github-tags/index.ts';
import { GitlabTagsDatasource } from '../gitlab-tags/index.ts';
import type { GetReleasesConfig, ReleaseResult } from '../types.ts';
import { ProtoPluginGitUrl, ProtoPluginGitUrlToml } from './schema.ts';

/**
 * Resolves a proto [TOML plugin](https://moonrepo.dev/docs/proto/non-wasm-plugin)
 * into releases. The `packageName` is the plugin locator from a `.prototools`
 * file: an `http(s)://` URL (fetched) or a repository-relative path from a
 * `file://` locator (read locally). The plugin's `[resolve] git-url` is looked
 * up via the github, gitlab or git tags datasource.
 */
export class ProtoPluginDatasource extends Datasource {
  static readonly id = 'proto-plugin';

  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    "The source URL is the repository from the plugin's `[resolve] git-url`.";

  override supportsCustomRegistry(_packageName: string): boolean {
    return false;
  }

  private readonly github = new GithubTagsDatasource();
  private readonly gitlab = new GitlabTagsDatasource();
  private readonly gitTags = new GitTagsDatasource();

  constructor() {
    super(ProtoPluginDatasource.id);
  }

  // Not cached here: the locator may be a private URL or a repository-relative
  // path, and the tags datasource it delegates to caches its own lookups.
  async getReleases({
    packageName: locator,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const gitUrl = await this.loadGitUrl(locator);
    if (!gitUrl) {
      logger.debug({ locator }, 'proto-plugin: plugin has no git-url');
      return null;
    }

    const platform = detectPlatform(gitUrl);
    if (platform === 'github' || platform === 'gitlab') {
      const { host, full_name } = parseGitUrl(gitUrl);
      const delegate = platform === 'github' ? this.github : this.gitlab;
      return delegate.getReleases({
        packageName: full_name,
        registryUrl: `https://${host}`,
      });
    }
    return this.gitTags.getReleases({ packageName: gitUrl });
  }

  private async loadGitUrl(locator: string): Promise<string | null> {
    if (isHttpUrl(locator)) {
      try {
        const { body } = await this.http.getToml(locator, ProtoPluginGitUrl);
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
    const parsed = ProtoPluginGitUrlToml.safeParse(content);
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
