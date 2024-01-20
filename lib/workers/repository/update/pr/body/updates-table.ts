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

  const uniqueUpgrades = filterDuplicateUpgrades(config.upgrades);
  const tableValues = uniqueUpgrades
    .filter((upgrade) => upgrade !== undefined)
    .map((upgrade) => {
      const res: Record<string, string> = {};
      const rowDefinition = getRowDefinition(config.prBodyColumns!, upgrade);
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
      return res;
    });
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

function filterDuplicateUpgrades(
  upgrades: BranchUpgradeConfig[],
): BranchUpgradeConfig[] {
  // Create an empty object to track unique combinations of properties
  const uniqueObjects: Record<string, boolean> = {};

  // Filter the array to remove duplicates
  const resultArray = upgrades
    .filter((upgrade) => upgrade !== undefined)
    .filter((obj) => {
      // Create a key based on the specified properties
      const key = `${obj.depName}_${obj.depType}_${obj.newValue}_${obj.currentValue}`;

      // Check if the key already exists in the uniqueObjects
      // If it doesn't exist, add the key and return true (keep the object)
      if (!uniqueObjects[key]) {
        uniqueObjects[key] = true;
        return true;
      }

      // If the key already exists, return false (filter out the duplicate object)
      return false;
    });

  return resultArray;
}
