export interface CrowConfig {
  pipeline?: Record<string, CrowStep>;
  steps?: Record<string, CrowStep>;
  clone?: Record<string, CrowStep>;
}

export interface CrowStep {
  image?: string;
}
