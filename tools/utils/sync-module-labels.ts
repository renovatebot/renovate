import { quote } from 'shlex';
import { getDatasourceList } from '../../lib/modules/datasource/index.ts';
import { allManagersList } from '../../lib/modules/manager/index.ts';
import { getPlatformList } from '../../lib/modules/platform/index.ts';

export type ModuleLabelKind = 'datasource' | 'manager' | 'platform';

export interface GitHubLabel {
  color: string;
  description: string;
  name: string;
}

export interface CliOptions {
  repo: string;
  showCommands?: boolean;
}

const moduleLabelColor = 'C5DEF5';

export function getLabelDescription(
  kind: ModuleLabelKind,
  moduleId: string,
): string {
  return `Related to the ${moduleId} ${kind}`;
}

export function createModuleLabel(
  kind: ModuleLabelKind,
  moduleId: string,
): GitHubLabel {
  return {
    color: moduleLabelColor,
    description: getLabelDescription(kind, moduleId),
    name: `${kind}:${moduleId}`,
  };
}

function getSortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

export function getExpectedModuleLabels(): GitHubLabel[] {
  const datasources = getSortedUnique(getDatasourceList()).map((datasource) =>
    createModuleLabel('datasource', datasource),
  );
  const managers = getSortedUnique(allManagersList).map((manager) =>
    createModuleLabel('manager', manager),
  );
  const platforms = getSortedUnique(getPlatformList()).map((platform) =>
    createModuleLabel('platform', platform),
  );

  return [...datasources, ...managers, ...platforms].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}

export function getMissingModuleLabels(
  expectedLabels: GitHubLabel[],
  existingLabels: GitHubLabel[],
): GitHubLabel[] {
  const existingNames = new Set(existingLabels.map((label) => label.name));

  return expectedLabels.filter((label) => !existingNames.has(label.name));
}

export function formatMissingLabels(labels: GitHubLabel[]): string {
  const sections: Record<ModuleLabelKind, string[]> = {
    datasource: [],
    manager: [],
    platform: [],
  };

  for (const label of labels) {
    const kind = label.name.split(':')[0] as ModuleLabelKind;
    sections[kind].push(label.name);
  }

  const lines: string[] = [];

  for (const kind of ['datasource', 'manager', 'platform'] as const) {
    const names = sections[kind];
    if (names.length === 0) {
      continue;
    }
    lines.push(`${kind}s (${names.length}):`);
    for (const name of names) {
      lines.push(`- ${name}`);
    }
  }

  return lines.join('\n');
}

export function getCreateLabelCommand(
  repo: string,
  label: GitHubLabel,
): string {
  return (
    `gh label create ${quote(label.name)} -R ${quote(repo)}` +
    ` --color ${quote(label.color)}` +
    ` --description ${quote(label.description)}`
  );
}

export function formatCreateLabelCommands(
  repo: string,
  labels: GitHubLabel[],
): string {
  return [...labels]
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((label) => getCreateLabelCommand(repo, label))
    .join('\n');
}
