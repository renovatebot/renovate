import { diffLines } from 'diff';
import markdownTable from 'markdown-table';
import { parseLine } from './line-parser';
import type { ExtraDep } from './types';

export function getExtraDeps(
  goModBefore: string,
  goModAfter: string,
  excludeDeps: string[],
): ExtraDep[] {
  const result: ExtraDep[] = [];

  const diff = diffLines(goModBefore, goModAfter, {
    newlineIsToken: true,
  });

  const addDeps: Record<string, string> = {};
  const rmDeps: Record<string, string> = {};
  for (const { added, removed, value } of diff) {
    if (!added && !removed) {
      continue;
    }

    const res = parseLine(value);
    if (!res) {
      continue;
    }

    const { depName, depType, currentValue } = res;
    if (!depName || !currentValue) {
      continue;
    }

    let expandedDepName = depName;
    // NOTE: Right now the only special depType we care about is 'toolchain' because the table
    // rendering prior to this change was ambiguous with regards to go version vs toolchain
    // version updates.
    if (depType === 'toolchain') {
      expandedDepName = `${depName} (${depType})`;
    }

    if (added) {
      addDeps[expandedDepName] = currentValue;
    } else {
      rmDeps[expandedDepName] = currentValue;
    }
  }

  for (const [depName, currentValue] of Object.entries(rmDeps)) {
    if (excludeDeps.includes(depName)) {
      continue;
    }

    const newValue = addDeps[depName];
    if (newValue) {
      result.push({
        depName,
        currentValue,
        newValue,
      });
    }
  }

  return result;
}

export function extraDepsTable(extraDeps: ExtraDep[]): string {
  const tableLines: string[][] = [];

  tableLines.push(['**Package**', '**Change**']);

  for (const { depName, currentValue, newValue } of extraDeps) {
    const depNameQuoted = `\`${depName}\``;
    const versionChangeQuoted = `\`${currentValue}\` -> \`${newValue}\``;
    tableLines.push([depNameQuoted, versionChangeQuoted]);
  }

  return markdownTable(tableLines, {
    align: ['l', 'l'],
  });
}

export function getExtraDepsNotice(
  goModBefore: string | null,
  goModAfter: string | null,
  excludeDeps: string[],
): string | null {
  if (!goModBefore || !goModAfter) {
    return null;
  }

  const extraDeps = getExtraDeps(goModBefore, goModAfter, excludeDeps);
  if (extraDeps.length === 0) {
    return null;
  }

  const noticeLines: string[] = [
    'In order to perform the update(s) described in the table above, Renovate ran the `go get` command, which resulted in the following additional change(s):',
    '\n',
  ];

  const goUpdated = extraDeps.some(({ depName }) => depName === 'go');
  const toolchainUpdated = extraDeps.some(
    ({ depName }) => depName === 'go (toolchain)',
  );
  const otherDepsCount =
    extraDeps.length - (goUpdated ? 1 : 0) - (toolchainUpdated ? 1 : 0);

  if (otherDepsCount === 1) {
    noticeLines.push(`- ${otherDepsCount} additional dependency was updated`);
  } else if (otherDepsCount > 1) {
    noticeLines.push(
      `- ${otherDepsCount} additional dependencies were updated`,
    );
  }

  if (goUpdated) {
    noticeLines.push(
      '- The `go` directive was updated for compatibility reasons',
    );
  }

  noticeLines.push('\n');
  noticeLines.push('Details:');
  noticeLines.push('\n');
  noticeLines.push(extraDepsTable(extraDeps));

  return noticeLines.join('\n');
}
