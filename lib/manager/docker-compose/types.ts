export interface DockerComposeConfig {
  version?: string;
  services?: Record<string, DockerComposeService>;
}
export interface DockerComposeService {
  image?: string;
  build?: {
    context?: string;
    dockerfile?: string;
  };
}
