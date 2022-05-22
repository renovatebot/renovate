/**
 * VelaPipelineConfiguration
 *
 * Spec: https://github.com/go-vela/types/releases/latest/download/schema.json
 * Docs: https://go-vela.github.io/docs/reference/yaml/
 */
export interface VelaPipelineConfiguration {
  secrets?: {
    origin?: ObjectWithImageProp;
  }[];

  services?: ObjectWithImageProp[];

  stages?: Record<string, Stage>;

  steps?: ObjectWithImageProp[];
}

export interface ObjectWithImageProp {
  image: string;
}

export interface Stage {
  steps: ObjectWithImageProp[];
}
