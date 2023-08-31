import { z } from 'zod';
import { logger } from '../../../logger';
import { LooseArray } from '../../../util/schema-utils';
import type { Release } from '../types';

// Helm manifests
export const HelmConfigBlob = z.object({
  home: z.string().optional(),
  sources: z.array(z.string()).optional(),
});

// OCI manifests

/**
 *  OCI manifest object
 */
export const ManifestObject = z.object({
  schemaVersion: z.literal(2),
  mediaType: z.string(),
});

/**
 * Oci descriptor
 * https://github.com/opencontainers/image-spec/blob/main/descriptor.md
 */
export const Descriptor = z.object({
  mediaType: z.string(),
  digest: z.string(),
  size: z.number(),
});
/**
 * OCI platform properties
 * https://github.com/opencontainers/image-spec/blob/main/image-index.md
 */
const OciPlatform = z
  .object({
    architecture: z.string().optional(),
  })
  .optional();

/**
 * OCI Image Configuration.
 *
 * Compatible with old docker configiguration.
 https://github.com/opencontainers/image-spec/blob/main/config.md
 */
export const OciImageConfig = z.object({
  architecture: z.string(),
  config: z.object({ Labels: z.record(z.string()).optional() }).optional(),
});
export type OciImageConfig = z.infer<typeof OciImageConfig>;

/**
 * OCI Image Manifest
 * The same structure as docker image manifest, but mediaType is not required and is not present in the wild.
 * https://github.com/opencontainers/image-spec/blob/main/manifest.md
 */
export const OciImageManifest = ManifestObject.extend({
  mediaType: z
    .literal('application/vnd.oci.image.manifest.v1+json')
    .default('application/vnd.oci.image.manifest.v1+json'),
  config: Descriptor.extend({
    mediaType: z.enum([
      'application/vnd.oci.image.config.v1+json',
      'application/vnd.cncf.helm.config.v1+json',
    ]),
  }),
  annotations: z.record(z.string()).optional(),
});

/**
 * OCI Image List
 * mediaType is not required.
 * https://github.com/opencontainers/image-spec/blob/main/image-index.md
 */
export const OciImageIndexManifest = ManifestObject.extend({
  mediaType: z
    .literal('application/vnd.oci.image.index.v1+json')
    .default('application/vnd.oci.image.index.v1+json'),
  manifests: z.array(
    Descriptor.extend({
      mediaType: z.enum([
        'application/vnd.oci.image.manifest.v1+json',
        'application/vnd.oci.image.index.v1+json',
      ]),
      platform: OciPlatform,
    })
  ),
  annotations: z.record(z.string()).optional(),
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

/**
 * Manifest List
 * https://docs.docker.com/registry/spec/manifest-v2-2/#manifest-list
 */
export const DistributionListManifest = ManifestObject.extend({
  mediaType: z.literal(
    'application/vnd.docker.distribution.manifest.list.v2+json'
  ),
  manifests: z.array(
    Descriptor.extend({
      mediaType: z.literal(
        'application/vnd.docker.distribution.manifest.v2+json'
      ),
      platform: OciPlatform,
    })
  ),
});

// Combined manifests

export const Manifest = z.union([
  DistributionManifest,
  DistributionListManifest,
  OciImageManifest,
  OciImageIndexManifest,
]);

export type Manifest = z.infer<typeof Manifest>;

export const DockerHubTag = z
  .object({
    name: z.string(),
    tag_last_pushed: z.string().datetime().nullable().catch(null),
  })
  .transform(({ name, tag_last_pushed }) => {
    const release: Release = { version: name };

    if (tag_last_pushed) {
      release.releaseTimestamp = tag_last_pushed;
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
          'Docker: Failed to parse some tags from Docker Hub'
        );
      },
    }),
  })
  .transform(({ next, results }) => ({
    nextPage: next,
    items: results,
  }));
