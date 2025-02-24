export interface WoodpeckerConfig {
  pipeline?: Record<string, WoodpeckerStep>;
  steps?: Record<string, WoodpeckerStep>;
  clone?: Record<string, WoodpeckerStep>;
}

export interface WoodpeckerStep {
  image?: string;
}
