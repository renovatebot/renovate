import { isString } from '@sindresorhus/is';
import type { Category } from '../constants/index.ts';
import type {
  AdditionalConstraintName,
  ConstraintName,
  ToolConfig,
  ToolName,
} from '../util/exec/types.ts';
import modulesDataJson from './modules.generated.json' with { type: 'json' };

/**
 * The data of managers, datasources and tools needed by `lib/config`, as written to `modules.generated.json` by `pnpm generate`.
 */
export interface ModulesData {
  tools: Partial<Record<ToolName, ToolConfig>>;
  toolNames: ToolName[];
  toolDocs: { name: ToolName; description?: string }[];
  constraints: { name: AdditionalConstraintName; description?: string }[];
  managers: Record<
    string,
    { displayName: string; categories?: Category[]; custom: boolean }
  >;
  datasources: Record<string, { defaultConfig?: Record<string, unknown> }>;
}

const data: ModulesData = modulesDataJson as ModulesData;

/**
 * All Containerbase `tool`s that Renovate supports configuring the version of.
 */
export function getSupportedToolNames(): readonly ToolName[] {
  return Object.keys(data.tools) as ToolName[];
}

export function getToolConfig(toolName: ToolName): ToolConfig | undefined {
  return data.tools[toolName];
}

export function isToolName(value: unknown): value is ToolName {
  return isString(value) && data.toolNames.some((n) => n === value);
}

function isAdditionalConstraintName(
  value: unknown,
): value is AdditionalConstraintName {
  return isString(value) && data.constraints.some((c) => c.name === value);
}

export function isConstraintName(value: unknown): value is ConstraintName {
  return isToolName(value) || isAdditionalConstraintName(value);
}

export function isCustomManager(manager: string): boolean {
  return data.managers[manager]?.custom ?? false;
}

export function getManagerCategories(manager: string): Category[] | undefined {
  return data.managers[manager]?.categories;
}

export function getDatasourceDefaultConfig(
  datasource: string,
): Record<string, unknown> | undefined {
  return data.datasources[datasource]?.defaultConfig;
}
