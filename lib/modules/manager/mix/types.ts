import type { HostRule } from '../../../types';

export interface Registry {
  name: string;
  registry: string;
}

export interface RegistryRule extends Registry {
  hostRule: HostRule;
}
