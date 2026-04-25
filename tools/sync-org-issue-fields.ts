import { Command } from 'commander';
import { quote } from 'shlex';
import { init, logger } from '../lib/logger/index.ts';
import { getDatasourceList } from '../lib/modules/datasource/index.ts';
import { allManagersList } from '../lib/modules/manager/index.ts';
import { getPlatformList } from '../lib/modules/platform/index.ts';
import { exec } from './utils/exec.ts';

export type IssueFieldKind = 'Datasource' | 'Manager' | 'Platform';

export interface IssueFieldOption {
  name: string;
  description: string;
  color: string;
  priority: number;
}

export interface OrgIssueField {
  id: number;
  name: string;
  data_type: string;
  description: string;
  options: IssueFieldOption[];
}

export interface ExpectedIssueField {
  name: IssueFieldKind;
  data_type: 'single_select';
  description: string;
  options: IssueFieldOption[];
}

export interface CliOptions {
  org: string;
  showCommands?: boolean;
}

export interface MissingOptions {
  field: OrgIssueField;
  missingOptions: IssueFieldOption[];
}

const defaultOrg = 'renovatebot';

function getSortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

export function createIssueFieldOption(
  kind: IssueFieldKind,
  moduleId: string,
): IssueFieldOption {
  return {
    name: moduleId,
    description: `Related to the ${moduleId} ${kind.toLowerCase()}`,
    color: 'gray',
    priority: 1,
  };
}

export function getExpectedIssueFields(): ExpectedIssueField[] {
  return [
    {
      name: 'Datasource',
      data_type: 'single_select',
      description: 'The datasource module related to this issue',
      options: getSortedUnique(getDatasourceList()).map((id) =>
        createIssueFieldOption('Datasource', id),
      ),
    },
    {
      name: 'Manager',
      data_type: 'single_select',
      description: 'The manager module related to this issue',
      options: getSortedUnique(allManagersList).map((id) =>
        createIssueFieldOption('Manager', id),
      ),
    },
    {
      name: 'Platform',
      data_type: 'single_select',
      description: 'The platform module related to this issue',
      options: getSortedUnique(getPlatformList()).map((id) =>
        createIssueFieldOption('Platform', id),
      ),
    },
  ];
}

export function getMissingIssueFields(
  expectedFields: ExpectedIssueField[],
  existingFields: OrgIssueField[],
): ExpectedIssueField[] {
  const existingNames = new Set(existingFields.map((f) => f.name));
  return expectedFields.filter((f) => !existingNames.has(f.name));
}

export function getMissingFieldOptions(
  expectedFields: ExpectedIssueField[],
  existingFields: OrgIssueField[],
): MissingOptions[] {
  const result: MissingOptions[] = [];

  for (const expected of expectedFields) {
    const existing = existingFields.find((f) => f.name === expected.name);
    if (!existing) {
      continue;
    }

    const existingOptions = new Set(existing.options.map((o) => o.name));
    const missingOptions = expected.options.filter(
      (o) => !existingOptions.has(o.name),
    );

    if (missingOptions.length > 0) {
      result.push({ field: existing, missingOptions });
    }
  }

  return result;
}

export function getCreateFieldCommand(
  org: string,
  field: ExpectedIssueField,
): string {
  const body = JSON.stringify({
    name: field.name,
    data_type: field.data_type,
    description: field.description,
    options: field.options,
  });
  return `echo ${quote(body)} | gh api -X POST /orgs/${quote(org)}/issue-fields --input -`;
}

export function getUpdateFieldOptionsCommand(
  org: string,
  missing: MissingOptions,
  allOptions: IssueFieldOption[],
): string {
  const body = JSON.stringify({ options: allOptions });
  return `echo ${quote(body)} | gh api -X PATCH /orgs/${quote(org)}/issue-fields/${missing.field.id} --input -`;
}

async function getOrgIssueFields(org: string): Promise<OrgIssueField[]> {
  const result = await exec('gh', ['api', `/orgs/${org}/issue-fields`]);
  return JSON.parse(result.stdout) as OrgIssueField[];
}

await init();

process.on('unhandledRejection', (err) => {
  logger.error({ err }, 'unhandledRejection');
  process.exit(-1);
});

const program = new Command('node tools/sync-org-issue-fields.ts')
  .description('Check that datasource/manager/platform org issue fields exist.')
  .option('--org <name>', `Organization to query`, defaultOrg)
  .option(
    '--show-commands',
    'Print gh api commands for any missing fields or options',
  )
  .action(async (options: CliOptions) => {
    const expectedFields = getExpectedIssueFields();
    const existingFields = await getOrgIssueFields(options.org);

    const missingFields = getMissingIssueFields(expectedFields, existingFields);
    const missingFieldOptions = getMissingFieldOptions(
      expectedFields,
      existingFields,
    );

    if (missingFields.length === 0 && missingFieldOptions.length === 0) {
      logger.info(
        `All datasource/manager/platform issue fields exist in ${options.org}.`,
      );
      return;
    }

    if (missingFields.length > 0) {
      logger.error(
        `Missing ${missingFields.length} issue fields in ${options.org}:\n${missingFields.map((f) => f.name).join(', ')}`,
      );
    }

    for (const { field, missingOptions } of missingFieldOptions) {
      logger.error(
        `Missing ${missingOptions.length} options in issue field "${field.name}" in ${options.org}:\n- ${missingOptions.map((o) => o.name).join('\n- ')}`,
      );
    }

    if (options.showCommands) {
      const commands: string[] = [];

      for (const field of missingFields) {
        commands.push(getCreateFieldCommand(options.org, field));
      }

      for (const missing of missingFieldOptions) {
        const allOptions = [
          ...missing.field.options,
          ...missing.missingOptions,
        ];
        commands.push(
          getUpdateFieldOptionsCommand(options.org, missing, allOptions),
        );
      }

      logger.info(
        `Run the following commands to sync the missing fields/options:\n${commands.join('\n')}`,
      );
    }

    process.exitCode = 1;
  });

void program.parseAsync();
