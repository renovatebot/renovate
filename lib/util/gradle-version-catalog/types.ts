export interface VersionCatalogManagerData {
  fileReplacePosition?: number;
  packageFile?: string;
  libraryAlias?: string;
}

export interface VersionCatalogVariable extends VersionCatalogManagerData {
  key: string;
  value: string;
}

export type VersionCatalogVariables = Record<string, VersionCatalogVariable>;

export interface GradleCatalog {
  versions?: Record<string, GradleVersionPointerTarget>;
  libraries?: Record<
    string,
    GradleCatalogModuleDescriptor | GradleCatalogArtifactDescriptor | string
  >;
  plugins?: Record<string, GradleCatalogPluginDescriptor | string>;
}

export interface GradleCatalogModuleDescriptor {
  module: string;
  version?: GradleVersionCatalogVersion;
}

export interface GradleCatalogArtifactDescriptor {
  name: string;
  group: string;
  version?: GradleVersionCatalogVersion;
}

export interface GradleCatalogPluginDescriptor {
  id: string;
  version: GradleVersionCatalogVersion;
}

export interface VersionPointer {
  ref: string;
}

/**
 * Rich version declarations in Gradle version catalogs
 *
 * @see https://docs.gradle.org/current/userguide/rich_versions.html
 * @see https://docs.gradle.org/current/userguide/platforms.html#sub::toml-dependencies-format
 */
export interface RichVersion {
  require?: string;
  strictly?: string;
  prefer?: string;
  reject?: string[];
  rejectAll?: boolean;
}

// references cannot themselves be references
export type GradleVersionPointerTarget = string | RichVersion;
export type GradleVersionCatalogVersion = string | VersionPointer | RichVersion;
