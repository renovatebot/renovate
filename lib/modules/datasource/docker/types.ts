// FIXME #12556
/* eslint-disable @typescript-eslint/naming-convention */
/**
 * Media Types
 * https://docs.docker.com/registry/spec/manifest-v2-2/#media-types
 * https://github.com/opencontainers/image-spec/blob/main/media-types.md
 */
// eslint-disable-next-line typescript-enum/no-enum
export enum MediaType {
  manifestV1 = 'application/vnd.docker.distribution.manifest.v1+json',
  manifestV2 = 'application/vnd.docker.distribution.manifest.v2+json',
  manifestListV2 = 'application/vnd.docker.distribution.manifest.list.v2+json',
  ociManifestV1 = 'application/vnd.oci.image.manifest.v1+json',
  ociManifestIndexV1 = 'application/vnd.oci.image.index.v1+json',
}
/* eslint-enable @typescript-eslint/naming-convention */

export interface MediaObject {
  readonly digest: string;
  readonly mediaType: MediaType;
  readonly size: number;
}

export interface ImageListImage extends MediaObject {
  readonly mediaType: MediaType.manifestV1 | MediaType.manifestV2;

  readonly platform: OciPlatform;
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
 * OCI platform properties
 * https://github.com/opencontainers/image-spec/blob/main/image-index.md
 */
export interface OciPlatform {
  architecture?: string;
  features?: string[];
  os?: string;
  'os.features'?: string[];
  'os.version'?: string;
  variant?: string;
}

/**
 * OCI content descriptor
 * https://github.com/opencontainers/image-spec/blob/main/descriptor.md
 */
export interface OciDescriptor {
  readonly mediaType?: MediaType;
  readonly digest: string;
  readonly size: number;
  readonly urls: string[];
  readonly annotations: Record<string, string>;
}

/**
 * OCI Image Manifest
 * The same structure as docker image manifest, but mediaType is not required and is not present in the wild.
 * https://github.com/opencontainers/image-spec/blob/main/manifest.md
 */
export interface OciImage {
  readonly schemaVersion: 2;
  readonly mediaType?: MediaType.ociManifestV1;
  readonly config: OciDescriptor;
  readonly layers: OciDescriptor[];
  readonly annotations: Record<string, string>;
}

export interface OciImageListManifest extends OciDescriptor {
  readonly mediaType?: MediaType.ociManifestV1 | MediaType.ociManifestIndexV1;
  readonly platform: OciPlatform;
}

/**
 * OCI Image List
 * mediaType is not required.
 * https://github.com/opencontainers/image-spec/blob/main/image-index.md
 */
export interface OciImageList {
  readonly schemaVersion: 2;
  readonly mediaType?: MediaType.ociManifestIndexV1;
  readonly manifests: OciImageListManifest[];
}

export interface RegistryRepository {
  registryHost: string;
  dockerRepository: string;
}

/**
 * OCI Image Configuration
 * https://github.com/opencontainers/image-spec/blob/main/config.md
 */
export interface ImageConfig {
  readonly architecture: string;
}
