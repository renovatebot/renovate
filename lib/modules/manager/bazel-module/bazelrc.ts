import upath from 'upath';
import { logger } from '../../../logger';
import { isNotNullOrUndefined } from '../../../util/array';
import * as fs from '../../../util/fs';
import { regEx } from '../../../util/regex';

const importRegex = regEx(`^(?<type>(?:try-)?import)\\s+(?<path>\\S+)$`);
const optionRegex = regEx(
  `^(?<command>\\w+)(:(?<config>\\S+))?\\s+(?<options>.*)$`,
);
const spaceRegex = regEx(`\\s+`);

export class ImportEntry {
  readonly entryType = 'import';
  constructor(
    readonly path: string,
    readonly isTry: boolean,
  ) {}
}

export class BazelOption {
  constructor(
    readonly name: string,
    readonly value?: string,
  ) {}

  static parse(input: string): BazelOption[] {
    const options: BazelOption[] = [];
    const parts = input.split(spaceRegex);
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part.startsWith('--')) {
        continue;
      }

      const nameStartIdx = 2;
      // Check for --option_name=option_value
      const equalSignIdx = part.indexOf('=');
      if (equalSignIdx >= 0) {
        const name = part.substring(nameStartIdx, equalSignIdx);
        const value = part.substring(equalSignIdx + 1);
        options.push(new BazelOption(name, value));
        continue;
      }

      const name = part.substring(nameStartIdx);
      const nextIdx = i + 1;
      // Check for --option_name OR --option_name option_value
      const value =
        nextIdx < parts.length && !parts[nextIdx].startsWith('--')
          ? parts[nextIdx]
          : undefined;
      options.push(new BazelOption(name, value));
    }
    return options;
  }
}

export class CommandEntry {
  readonly entryType = 'command';
  constructor(
    readonly command: string,
    readonly options: BazelOption[],
    readonly config?: string,
  ) {}

  getOption(name: string): BazelOption | undefined {
    return this.options.find((bo) => bo.name === name);
  }
}

type BazelrcEntries = ImportEntry | CommandEntry;

function shouldProcessLine(line: string): boolean {
  if (line.length === 0) {
    return false;
  }
  return !line.startsWith('#');
}

function createEntry(line: string): BazelrcEntries | undefined {
  const importResult = importRegex.exec(line);
  if (importResult?.groups) {
    const irGroups = importResult.groups;
    return new ImportEntry(irGroups.path, irGroups.type === 'try-import');
  }
  const optionResult = optionRegex.exec(line);
  if (optionResult?.groups) {
    const orGroups = optionResult.groups;
    return new CommandEntry(
      orGroups.command,
      BazelOption.parse(orGroups.options),
      orGroups.config,
    );
  }
  return undefined;
}

export function parse(contents: string): BazelrcEntries[] {
  return contents
    .split('\n')
    .map((l) => l.trim())
    .filter(shouldProcessLine)
    .map(createEntry)
    .filter(isNotNullOrUndefined);
}

async function readFile(
  file: string,
  workspaceDir: string,
  readFiles: Set<string>,
): Promise<CommandEntry[]> {
  if (readFiles.has(file)) {
    throw new Error(
      `Attempted to read a bazelrc multiple times. file: ${file}`,
    );
  }
  readFiles.add(file);
  const contents = await fs.readLocalFile(file, 'utf8');
  if (!contents) {
    return [];
  }
  const entries = parse(contents);
  const results: CommandEntry[] = [];
  for (const entry of entries) {
    if (entry.entryType === 'command') {
      results.push(entry);
      continue;
    }

    const importFile = upath.normalize(
      entry.path.replace('%workspace%', workspaceDir),
    );
    if (fs.isValidLocalPath(importFile)) {
      const importEntries = await readFile(importFile, workspaceDir, readFiles);
      results.push(...importEntries);
    } else {
      logger.debug(`Skipping non-local .bazelrc import ${importFile}`);
    }
  }
  return results;
}

export async function read(workspaceDir: string): Promise<CommandEntry[]> {
  const bazelrcPath = upath.join(workspaceDir, '.bazelrc');
  const readFiles = new Set<string>();
  return await readFile(bazelrcPath, workspaceDir, readFiles);
}
