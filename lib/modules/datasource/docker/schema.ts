import { z } from 'zod';
import { logger } from '../../../logger';
import { Json, LooseArray } from '../../../util/schema-utils';
import type { Release } from '../types';

// OCI manifests

/**
 *  OCI manifest object
 */
export const ManifestObject = z.object({
  schemaVersion: z.literal(2),
  mediaType: z.string().nullish(),
});

/**
 * Oci descriptor
 * https://github.com/opencontainers/image-spec/blob/main/descriptor.md
 */
export const Descriptor = z.object({
  mediaType: z.string(),
  digest: z.string(),
  size: z.number().int().gt(0).nullish(),
});
/**
 * OCI platform properties
 * https://github.com/opencontainers/image-spec/blob/main/image-index.md
 */
const OciPlatform = z
  .object({
    architecture: z.string().nullish(),
  })
  .nullish();

/**
 * OCI Image Configuration.
 *
 * Compatible with old docker configiguration.
 * https://github.com/opencontainers/image-spec/blob/main/config.md
 */
export const OciImageConfig = z.object({
  // This is required by the spec, but probably not present in the wild.
  architecture: z.string().nullish(),
  config: z.object({ Labels: z.record(z.string()).nullish() }).nullish(),
});
export type OciImageConfig = z.infer<typeof OciImageConfig>;

/**
 * OCI Helm Configuration
 * https://helm.sh/docs/topics/charts/#the-chartyaml-file
 */
export const OciHelmConfig = z.object({
  name: z.string(),
  version: z.string(),
  home: z.string().nullish(),
  sources: z.array(z.string()).nullish(),
});
export type OciHelmConfig = z.infer<typeof OciHelmConfig>;

/**
 * OCI Image Manifest
 * The same structure as docker image manifest, but mediaType is not required and is not present in the wild.
 * https://github.com/opencontainers/image-spec/blob/main/manifest.md
 */
export const OciImageManifest = ManifestObject.extend({
  mediaType: z.literal('application/vnd.oci.image.manifest.v1+json'),
  config: Descriptor.extend({
    mediaType: z.enum([
      'application/vnd.oci.image.config.v1+json',
      'application/vnd.cncf.helm.config.v1+json',
    ]),
  }),
  annotations: z.record(z.string()).nullish(),
});
export type OciImageManifest = z.infer<typeof OciImageManifest>;

/**
 * OCI Image List
 * mediaType is not required.
 * https://github.com/opencontainers/image-spec/blob/main/image-index.md
 */
export const OciImageIndexManifest = ManifestObject.extend({
  mediaType: z.literal('application/vnd.oci.image.index.v1+json'),
  manifests: z.array(
    Descriptor.extend({
      mediaType: z.enum([
        'application/vnd.oci.image.manifest.v1+json',
        'application/vnd.oci.image.index.v1+json',
      ]),
      platform: OciPlatform,
    }),
  ),
  annotations: z.record(z.string()).nullish(),
});

// Old Docker manifests

/**
 * Image Manifest
 * https://docs.docker.com/registry/spec/manifest-v2-2/#image-manifest
 */
export const DistributionManifest = ManifestObject.extend({
  mediaType: z.literal('application/vnd.docker.distribution.manifest.v2+json'),
  config: Descriptor.extend({
    mediaType: z.literal('application/vnd.docker.container.image.v1+json'),
  }),
});
export type DistributionManifest = z.infer<typeof DistributionManifest>;

/**
 * Manifest List
 * https://docs.docker.com/registry/spec/manifest-v2-2/#manifest-list
 */
export const DistributionListManifest = ManifestObject.extend({
  mediaType: z.literal(
    'application/vnd.docker.distribution.manifest.list.v2+json',
  ),
  manifests: z.array(
    Descriptor.extend({
      mediaType: z.literal(
        'application/vnd.docker.distribution.manifest.v2+json',
      ),
      platform: OciPlatform,
    }),
  ),
});

// Combined manifests
export const Manifest = ManifestObject.passthrough()
  .transform((value, ctx) => {
    if (value.mediaType === undefined) {
      if ('config' in value) {
        value.mediaType = 'application/vnd.oci.image.manifest.v1+json';
      } else if ('manifests' in value) {
        value.mediaType = 'application/vnd.oci.image.index.v1+json';
      } else {
        ctx.addIssue({
          code: 'custom',
          message: 'Invalid manifest, missing mediaType.',
        });
        return z.NEVER;
      }
    }
    return value;
  })
  .pipe(
    z.discriminatedUnion('mediaType', [
      DistributionManifest,
      DistributionListManifest,
      OciImageManifest,
      OciImageIndexManifest,
    ]),
  );

export type Manifest = z.infer<typeof Manifest>;
export const ManifestJson = Json.pipe(Manifest);

export const DockerHubTag = z
  .object({
    name: z.string(),
    tag_last_pushed: z.string().datetime().nullable().catch(null),
    digest: z.string().nullable().catch(null),
  })
  .transform(({ name, tag_last_pushed, digest }) => {
    const release: Release = { version: name };

    if (tag_last_pushed) {
      release.releaseTimestamp = tag_last_pushed;
    }

    if (digest) {
      release.newDigest = digest;
    }

    return release;
  });

export const DockerHubTagsPage = z
  .object({
    next: z.string().nullable().catch(null),
    results: LooseArray(DockerHubTag, {
      onError: /* istanbul ignore next */ ({ error }) => {
        logger.debug(
          { error },
          'Docker: Failed to parse some tags from Docker Hub',
        );
      },
    }),
  })
  .transform(({ next, results }) => ({
    nextPage: next,
    items: results,
  }));
