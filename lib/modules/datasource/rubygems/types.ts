/**
 * see https://guides.rubygems.org/rubygems-org-api/#get---apiv1dependenciesgemscomma-delimited-gem-names
 */
export interface MarshalledVersionInfo {
  name: string;
  number: string;
  platform: string;
  dependencies: MarshalledDependency[];
}

export type MarshalledDependency = [name: string, version: string];

export interface JsonGemDependency {
  name: string;
  requirements: string;
}

/**
 * see https://guides.rubygems.org/rubygems-org-api/#get---apiv1gemsgem-namejsonyaml
 */
export interface JsonGemsInfo {
  // FIXME: This property doesn't exist in api
  changelog_uri: string;
  dependencies: {
    development: JsonGemDependency;
    runtime: JsonGemDependency;
  };
  homepage_uri: string;
  name: string;
  platform?: string;
  source_code_uri: string;
  version?: string;
}

/**
 * see https://guides.rubygems.org/rubygems-org-api/#get---apiv1versionsgem-namejsonyaml
 */
export interface JsonGemVersions {
  created_at: string;
  number: string;
  platform: string;
  rubygems_version: string;
  ruby_version: string;
}
