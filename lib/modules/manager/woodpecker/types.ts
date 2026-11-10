export interface WoodpeckerConfig {
  pipeline?: Record<string, WoodpeckerStep | null>;
  steps?: Record<string, WoodpeckerStep | null>;
  clone?: Record<string, WoodpeckerStep | null>;
}

export interface WoodpeckerStep {
  image?: string;
}
