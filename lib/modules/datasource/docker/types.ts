export interface RegistryRepository {
  registryHost: string;
  dockerRepository: string;
}

export interface DockerHubTags {
  next?: string;
  results: { name: string }[];
}
