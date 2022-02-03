import { logger } from '../../../logger';
import { regEx } from '../../../util/regex';
import * as template from '../../../util/template';
import type { BranchConfig, BranchUpgradeConfig } from '../../types';

type TableDefinition = {
  header: string;
  value: string;
};

function getRowDefinition(
  prBodyColumns: string[],
  upgrade: BranchUpgradeConfig
): TableDefinition[] {
  const res: TableDefinition[] = [];
  for (const header of prBodyColumns) {
    const value = upgrade.prBodyDefinitions[header];
    res.push({ header, value });
  }
  return res;
}

function getNonEmptyColumns(
  headers: string[],
  rows: Record<string, string>[]
): string[] {
  const res: string[] = [];
  for (const header of headers) {
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
  const headers = config.prBodyColumns;
  const tableValues = config.upgrades.map((upgrade) => {
    const res: Record<string, string> = {};
    const rowDefinition = getRowDefinition(headers, upgrade);
    for (const column of rowDefinition) {
      const { header, value } = column;
      try {
        // istanbul ignore else
        if (value) {
          res[header] = template
            .compile(value, upgrade)
            .replace(regEx(/^``$/), '');
        } else {
          res[header] = '';
        }
      } catch (err) /* istanbul ignore next */ {
        logger.warn({ header, value, err }, 'Handlebars compilation error');
      }
    }
    return res;
  });

  const tableColumns = getNonEmptyColumns(headers, tableValues);
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
