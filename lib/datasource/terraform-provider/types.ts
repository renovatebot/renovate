export interface TerraformProvider {
  namespace: string;
  name: string;
  provider: string;
  source?: string;
  versions: string[];
  version: string;
  published_at: string;
}
export interface TerraformProviderReleaseBackend {
  [key: string]: {
    name: string;
    versions: VersionsReleaseBackend;
  };
}
interface VersionsReleaseBackend {
  [key: string]: Record<string, any>;
}
