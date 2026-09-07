import type { PackageDependency } from '../types.ts';

export type StaticTooling = Partial<PackageDependency> &
  Required<Pick<PackageDependency, 'datasource'>>;

export type DynamicTooling = (version: string) => StaticTooling | undefined;

export type ToolingConfig = StaticTooling | DynamicTooling;

export interface ToolingDefinition {
  config: ToolingConfig;
  asdfPluginUrl: string;
}
