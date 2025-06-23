import type { FluxResource } from './schema';

export interface FluxManagerData {
  components?: string;
}

export interface FluxFile {
  file: string;
}

export interface ResourceFluxManifest extends FluxFile {
  kind: 'resource';
  resources: FluxResource[];
}

export interface SystemFluxManifest extends FluxFile {
  kind: 'system';
  version: string;
  components: string;
}

export type FluxManifest = ResourceFluxManifest | SystemFluxManifest;
