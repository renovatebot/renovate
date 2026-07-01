import * as hostRules from '../../../util/host-rules.ts';
import type { HttpOptions } from '../../../util/http/types.ts';
import { ensureTrailingSlash } from '../../../util/url.ts';
import * as swiftVersioning from '../../versioning/swift/index.ts';
import { Datasource } from '../datasource.ts';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types.ts';
import { SwiftRegistryReleases } from './schema.ts';

// SE-0292 fixed media type, used both as Accept header and in spec error responses.
// Servers MUST advertise the protocol version through this header.
const SWIFT_REGISTRY_ACCEPT = 'application/vnd.swift.registry.v1+json';

export class SwiftPackageRegistryDatasource extends Datasource {
  static readonly id = 'swift-package-registry';

  constructor() {
    super(SwiftPackageRegistryDatasource.id);
  }

  override readonly customRegistrySupport = true;

  // SE-0292 has no canonical "default" registry; users opt in by configuring one.
  override readonly defaultRegistryUrls = [];

  // Multiple registries may be discovered from registries.json (default + named scopes).
  // Try them in order, accept the first 200.
  override readonly registryStrategy = 'hunt';

  override readonly defaultVersioning = swiftVersioning.id;

  private static getHostOpts(url: string): HttpOptions {
    const { token, username, password } = hostRules.find({
      hostType: SwiftPackageRegistryDatasource.id,
      url,
    });
    const headers: Record<string, string> = {
      Accept: SWIFT_REGISTRY_ACCEPT,
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
      return { headers };
    }
    if (username && password) {
      return { headers, username, password };
    }
    return { headers };
  }

  async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    /* v8 ignore next 3 -- never reached: registryUrl set by hunt strategy */
    if (!registryUrl) {
      return null;
    }

    // Package identity is `scope.name`; the SE-0292 endpoint path is `/<scope>/<name>`.
    const dotIndex = packageName.indexOf('.');
    if (dotIndex <= 0 || dotIndex === packageName.length - 1) {
      return null;
    }
    const scope = packageName.slice(0, dotIndex);
    const name = packageName.slice(dotIndex + 1);

    const pkgUrl = `${ensureTrailingSlash(registryUrl)}${scope}/${name}`;
    const opts = SwiftPackageRegistryDatasource.getHostOpts(pkgUrl);

    let body: SwiftRegistryReleases;
    try {
      const response = await this.http.getJsonUnchecked(pkgUrl, opts);
      const parsed = SwiftRegistryReleases.safeParse(response.body);
      if (!parsed.success) {
        return null;
      }
      body = parsed.data;
    } catch (err) {
      this.handleGenericErrors(err);
    }

    const entries = Object.entries(body!.releases ?? {});
    if (!entries.length) {
      return null;
    }

    const releases: Release[] = entries
      .filter(([, entry]) => !entry.problem)
      .map(([version]) => ({ version }));

    if (!releases.length) {
      return null;
    }

    return { releases };
  }
}
