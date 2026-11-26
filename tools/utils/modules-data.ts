import { toolNames } from '@renovatebot/base-image';
import type { ModulesData } from '../../lib/config/modules-data.ts';
import { allToolConfig } from '../../lib/util/exec/containerbase.ts';
import {
  additionalConstraintDefinitions,
  toolDefinitionDocumentation,
} from '../../lib/util/exec/types.ts';
import { getDisplayName } from '../docs/utils.ts';

function sortKeys<T>(input: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(input).sort(([a], [b]) => a.localeCompare(b)),
  );
}

/**
 * Collects the data of the managers, datasources and tools which `lib/config` needs, from the real modules.
 */
export async function getModulesData(): Promise<ModulesData> {
  const { default: managers } =
    await import('../../lib/modules/manager/api.ts');
  const { default: customManagers } =
    await import('../../lib/modules/manager/custom/api.ts');
  const { default: datasources } =
    await import('../../lib/modules/datasource/api.ts');

  const managerData: ModulesData['managers'] = {};
  for (const [name, manager] of [
    ...managers.entries(),
    ...customManagers.entries(),
  ]) {
    managerData[name] = {
      displayName: getDisplayName(name, manager),
      ...(manager.categories && { categories: [...manager.categories] }),
      custom: customManagers.has(name),
    };
  }

  const datasourceData: ModulesData['datasources'] = {};
  for (const [id, datasource] of datasources.entries()) {
    datasourceData[id] = datasource.defaultConfig
      ? { defaultConfig: datasource.defaultConfig }
      : {};
  }

  return {
    tools: sortKeys(allToolConfig),
    toolNames: [...toolNames],
    toolDocs: [...toolDefinitionDocumentation],
    constraints: [...additionalConstraintDefinitions],
    managers: sortKeys(managerData),
    datasources: sortKeys(datasourceData),
  };
}
