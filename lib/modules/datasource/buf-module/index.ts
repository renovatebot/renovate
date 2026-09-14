import type { z } from 'zod/v4';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import { asTimestamp } from '../../../util/timestamp.ts';
import { joinUrlParts } from '../../../util/url.ts';
import { Datasource } from '../datasource.ts';
import type {
  DigestConfig,
  GetReleasesConfig,
  ReleaseResult,
} from '../types.ts';
import {
  GetRepositoryCommitByReferenceResponse,
  ListRepositoryCommitsByReferenceResponse,
} from './schema.ts';

const service = 'buf.alpha.registry.v1alpha1.RepositoryCommitService';

export class BufModuleDatasource extends Datasource {
  static readonly id = 'buf-module';

  constructor() {
    super(BufModuleDatasource.id);
  }

  override readonly defaultRegistryUrls = ['https://buf.build'];

  // BSR modules are an append-only history of opaque commits with no semver
  // ordering, so version bumps are driven by `getDigest`, not by sorting.
  override readonly defaultVersioning = 'loose';

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is determined from the `createTime` field returned by the Buf Schema Registry.';

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
      service,
      'ListRepositoryCommitsByReference',
    );

    let body: z.infer<typeof ListRepositoryCommitsByReferenceResponse>;
    try {
      body = (
        await this.http.postJson(
          url,
          { body: { repositoryOwner: owner, repositoryName: name } },
          ListRepositoryCommitsByReferenceResponse,
        )
      ).body;
    } catch (err) {
      this.handleGenericErrors(err);
    }

    const releases = body.repositoryCommits.map((commit) => ({
      version: commit.name,
      newDigest: commit.b5Digest,
      releaseTimestamp: asTimestamp(commit.createTime),
    }));

    if (!releases.length) {
      return null;
    }

    return {
      homepage: joinUrlParts(registryUrl, owner, name),
      releases,
    };
  }

  override getReleases(
    config: GetReleasesConfig,
  ): Promise<ReleaseResult | null> {
    return withCache(
      {
        namespace: `datasource-${BufModuleDatasource.id}`,
        key: `${config.registryUrl}:${config.packageName}`,
        cacheable: config.registryUrl === this.defaultRegistryUrls[0],
        fallback: true,
      },
      () => this._getReleases(config),
    );
  }

  override async getDigest(
    { packageName, registryUrl }: DigestConfig,
    newValue?: string,
  ): Promise<string | null> {
    const [owner, name] = packageName.split('/');
    if (!owner || !name) {
      return null;
    }

    const registry = registryUrl ?? this.defaultRegistryUrls[0];
    const url = joinUrlParts(
      registry,
      service,
      'GetRepositoryCommitByReference',
    );

    // Omitting `reference` resolves to the module's default label (`main`).
    const requestBody: Record<string, string> = {
      repositoryOwner: owner,
      repositoryName: name,
    };
    if (newValue) {
      requestBody.reference = newValue;
    }

    let body: z.infer<typeof GetRepositoryCommitByReferenceResponse>;
    try {
      body = (
        await this.http.postJson(
          url,
          { body: requestBody },
          GetRepositoryCommitByReferenceResponse,
        )
      ).body;
    } catch (err) {
      this.handleGenericErrors(err);
    }

    return body.repositoryCommit.name;
  }
}
