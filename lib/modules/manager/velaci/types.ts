/**
 * VelaPipelineConfiguration Types
 *
 * Spec: https://github.com/go-vela/types/releases/latest/download/schema.json
 * Docs: https://go-vela.github.io/docs/reference/yaml/
 */
export type Step = { image: string };

export interface VelaPipelineConfiguration {
  secrets?: {
    origin?: {
      image: string;
    };
  }[];

  services?: {
    image: string;
  }[];

  stages?: Record<string, Stage>;

  steps?: Step[];
}

export interface Stage {
  steps: Step[];
}
