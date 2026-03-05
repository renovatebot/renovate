import fs from 'fs-extra';
import upath from 'upath';
import { z } from 'zod/v4';
import type { CoverageInfo } from './types.ts';

const StatementLocation = z.object({
  start: z.object({ line: z.number() }),
  end: z.object({ line: z.number() }),
});

const CoverageEntry = z.object({
  statementMap: z.record(z.string(), StatementLocation),
  s: z.record(z.string(), z.number()),
});

const CoverageJson = z.record(z.string(), CoverageEntry);

type CoverageData = z.infer<typeof CoverageJson>;

function groupConsecutiveNumbers(numbers: number[]): string[] {
  if (numbers.length === 0) {
    return [];
  }

  const sorted = [...numbers].sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let end = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i];
    } else {
      ranges.push(start === end ? `${start}` : `${start}-${end}`);
      start = sorted[i];
      end = sorted[i];
    }
  }

  ranges.push(start === end ? `${start}` : `${start}-${end}`);
  return ranges;
}

function loadCoverageFile(coverageDir: string): CoverageData | null {
  const coverageFile = upath.resolve(coverageDir, 'coverage-final.json');
  if (!fs.existsSync(coverageFile)) {
    return null;
  }

  try {
    const rawJson: unknown = JSON.parse(fs.readFileSync(coverageFile, 'utf8'));
    const parseResult = CoverageJson.safeParse(rawJson);
    return parseResult.success ? parseResult.data : null;
  } catch {
    return null;
  }
}

function normalizeCoveragePaths(
  data: CoverageData,
): Map<string, CoverageData[string]> {
  const normalized = new Map<string, CoverageData[string]>();
  for (const [key, value] of Object.entries(data)) {
    normalized.set(upath.normalize(key), value);
  }
  return normalized;
}

function isSourceFile(path: string): boolean {
  return path.endsWith('.ts') && !path.endsWith('.spec.ts');
}

function extractFileCoverage(
  file: string,
  coverage: Map<string, CoverageData[string]>,
): CoverageInfo | null {
  const absPath = upath.resolve(process.cwd(), file);
  const entry = coverage.get(absPath);
  if (!entry) {
    return null;
  }

  const { statementMap, s: statementCoverage } = entry;
  const totalStatements = Object.keys(statementMap).length;
  if (totalStatements === 0) {
    return null;
  }

  const coveredStatements = Object.values(statementCoverage).filter(
    (count) => count > 0,
  ).length;
  const percentage = (coveredStatements / totalStatements) * 100;

  if (percentage >= 100) {
    return null;
  }

  const uncoveredLineSet = new Set<number>();
  for (const [stmtId, count] of Object.entries(statementCoverage)) {
    if (count !== 0) {
      continue;
    }

    const stmt = statementMap[stmtId];
    if (!stmt) {
      continue;
    }

    for (let line = stmt.start.line; line <= stmt.end.line; line++) {
      uncoveredLineSet.add(line);
    }
  }

  return {
    file,
    percentage,
    uncoveredLines: groupConsecutiveNumbers(Array.from(uncoveredLineSet)),
  };
}

export function parseCoverageJson(
  coverageDir: string,
  changedFiles: string[],
): CoverageInfo[] {
  const data = loadCoverageFile(coverageDir);
  if (!data) {
    return [];
  }

  const normalized = normalizeCoveragePaths(data);
  const results: CoverageInfo[] = [];

  for (const file of changedFiles) {
    if (!isSourceFile(file)) {
      continue;
    }
    const info = extractFileCoverage(file, normalized);
    if (info) {
      results.push(info);
    }
  }

  return results;
}
