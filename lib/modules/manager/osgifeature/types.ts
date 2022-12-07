export interface FeatureModel {
  'feature-resource-version'?: string;
  bundles?: Bundle[];
  'execution-environment:JSON|false'?: {
    framework?: Bundle;
  };
  [x: string]: any;
}

export type Bundle = string | BundleObject;

export interface BundleObject {
  id: string;
}
