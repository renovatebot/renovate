// FIXME #12556
/* eslint-disable @typescript-eslint/naming-convention */
/**
 * Media Types
 * https://docs.docker.com/registry/spec/manifest-v2-2/#media-types
 */
// eslint-disable-next-line typescript-enum/no-enum
export enum MediaType {
  manifestV1 = 'application/vnd.docker.distribution.manifest.v1+json',
  manifestV2 = 'application/vnd.docker.distribution.manifest.v2+json',
  manifestListV2 = 'application/vnd.docker.distribution.manifest.list.v2+json',
  ociManifestV1 = 'application/vnd.oci.image.manifest.v1+json',
}
/* eslint-enable @typescript-eslint/naming-convention */

export interface MediaObject {
  readonly digest: string;
  readonly mediaType: MediaType;
  readonly site: number;
}

export interface ImageListImage extends MediaObject {
  readonly mediaType: MediaType.manifestV1 | MediaType.manifestV2;

  readonly platform: Record<string, unknown>;
}

/**
 * Manifest List
 * https://docs.docker.com/registry/spec/manifest-v2-2/#manifest-list-field-descriptions
 */
export interface ImageList {
  readonly schemaVersion: 2;
  readonly mediaType: MediaType.manifestListV2;
  readonly manifests: ImageListImage[];
}

/**
 * Image Manifest
 * https://docs.docker.com/registry/spec/manifest-v2-2/#image-manifest
 */
export interface Image extends MediaObject {
  readonly schemaVersion: 2;
  readonly mediaType: MediaType.manifestV2;

  readonly config: MediaObject;
}

/**
 * OCI Image Manifest
 * The same structure as docker image manifest, but mediaType is not required and is not present in the wild.
 * https://github.com/opencontainers/image-spec/blob/main/manifest.md
 */
export interface OciImage {
  readonly schemaVersion: 2;
  readonly mediaType?: MediaType.ociManifestV1;
  readonly config: MediaObject;
}

export interface RegistryRepository {
  registryHost: string;
  dockerRepository: string;
}
