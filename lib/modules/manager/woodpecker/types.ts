export type WoodpeckerConfig = {
  pipeline?: Record<string, WoodpeckerStep>;
};

export interface WoodpeckerStep {
  image?: string;
}
