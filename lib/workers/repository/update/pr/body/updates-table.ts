import { logger } from '../../../../../logger';
import { regEx } from '../../../../../util/regex';
import * as template from '../../../../../util/template';
import type { BranchConfig, BranchUpgradeConfig } from '../../../../types';

type TableDefinition = {
  header: string;
  value: string | undefined;
};

function getRowDefinition(
  prBodyColumns: string[],
  upgrade: BranchUpgradeConfig,
): TableDefinition[] {
  const res: TableDefinition[] = [];
  if (upgrade.prBodyDefinitions) {
    for (const header of prBodyColumns) {
      const value = upgrade.prBodyDefinitions[header];
      res.push({ header, value });
    }
  }
  return res;
}

function getNonEmptyColumns(
  prBodyColumns: string[],
  rows: Record<string, string>[],
): string[] {
  const res: string[] = [];
  for (const header of prBodyColumns) {
    for (const row of rows) {
      if (row[header]?.length) {
        if (!res.includes(header)) {
          res.push(header);
        }
      }
    }
  }
  return res;
}

export function getPrUpdatesTable(config: BranchConfig): string {
  if (config.prBodyColumns === undefined) {
    logger.warn('getPrUpdatesTable - prBodyColumns is undefined');
    return '';
  }

  const tableKeyValuePairs: Record<string, Record<string, string>> = {};
  for (const upgrade of config.upgrades) {
    if (upgrade) {
      // Create a key based on the properties which are significant in the updates table
      const key = `${upgrade.depName ?? ''}_${upgrade.depType ?? ''}_${upgrade.newValue ?? ''}_${upgrade.newVersion ?? ''}_${upgrade.currentValue ?? ''}_${upgrade.currentVersion ?? ''}_${upgrade.updateType}`;

      const res: Record<string, string> = {};
      const rowDefinition = getRowDefinition(config.prBodyColumns, upgrade);
      for (const column of rowDefinition) {
        const { header, value } = column;
        try {
          // istanbul ignore else
          if (value) {
            res[header] = template
              .compile(value, upgrade)
              .replace(regEx(/``/g), '');
          } else {
            res[header] = '';
          }
        } catch (err) /* istanbul ignore next */ {
          logger.warn({ header, value, err }, 'Handlebars compilation error');
        }
      }

      if (tableKeyValuePairs[key]) {
        // compare the duplicate upgrades as per their table values
        // and select one with better values
        tableKeyValuePairs[key] = compareTableValues(
          tableKeyValuePairs[key],
          res,
          config.prBodyColumns,
        );
      } else {
        tableKeyValuePairs[key] = res;
      }
    }
  }

  const tableValues = Object.values(tableKeyValuePairs);
  const tableColumns = getNonEmptyColumns(config.prBodyColumns, tableValues);
  let res = '\n\nThis PR contains the following updates:\n\n';
  res += '| ' + tableColumns.join(' | ') + ' |\n';
  res += '|' + tableColumns.map(() => '---|').join('') + '\n';
  const rows = [];
  for (const row of tableValues) {
    let val = '|';
    for (const column of tableColumns) {
      const content = row[column]
        ? row[column]
            .replace(regEx(/^@/), '@&#8203;')
            .replace(regEx(/\|/g), '\\|')
        : '';
      val += ` ${content} |`;
    }
    val += '\n';
    rows.push(val);
  }
  const uniqueRows = [...new Set(rows)];
  res += uniqueRows.join('');
  res += '\n\n';
  return res;
}

// return the row with better table values
function compareTableValues(
  a: Record<string, string>,
  b: Record<string, string>,
  prBodyColumns: string[],
): Record<string, string> {
  let score = 0;

  for (const header of prBodyColumns) {
    if (!b[header] && !a[header]) {
      continue;
    }
    if (!b[header]) {
      score--;
      continue;
    }
    if (!a[header]) {
      score++;
      continue;
    }

    if (a[header] !== b[header]) {
      if (a[header].length < b[header].length) {
        score++;
      } else {
        score--;
      }
    }
  }
  return score > 0 ? b : a;
}
