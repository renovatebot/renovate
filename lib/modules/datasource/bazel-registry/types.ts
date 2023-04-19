/**
 * Represents a collection of versions that have been removed/yanked.
 */
export interface YankedVersions {
  // The key is the version and the value is a description of why it was yanked.
  [version: string]: string;
}

/**
 * Represents the contents of the `metadata.json` that exists in each module
 * directory. For information about the fields, please see
 * https://bazel.build/external/registry#index_registry
 */
export interface BazelModuleMetadataResponse {
  versions: string[];
  yanked_versions: YankedVersions;
}
