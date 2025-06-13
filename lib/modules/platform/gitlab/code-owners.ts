import ignore from 'ignore';
import { regEx } from '../../../util/regex';
import type { FileOwnerRule } from '../types';

interface CodeOwnersSection {
  name: string;
  defaultUsers: string[];
}

export function extractRulesFromCodeOwnersLines(
  cleanedLines: string[],
): FileOwnerRule[] {
  let currentSection: CodeOwnersSection = { name: '', defaultUsers: [] };
  const internalRules = [];

  for (const line of cleanedLines) {
    if (isSectionHeader(line)) {
      currentSection = changeCurrentSection(line);
    } else {
      const rule = extractOwnersFromLine(line, currentSection.defaultUsers);
      internalRules.push(rule);
    }
  }

  return internalRules;
}

function changeCurrentSection(line: string): CodeOwnersSection {
  const [name, ...usernames] = line.split(regEx(/\s+/));
  return { name, defaultUsers: usernames };
}

function extractOwnersFromLine(
  line: string,
  defaultUsernames: string[],
): FileOwnerRule {
  const [pattern, ...usernames] = line.split(regEx(/\s+/));
  const matchPattern = ignore().add(pattern);
  return {
    usernames: usernames.length > 0 ? usernames : defaultUsernames,
    pattern,
    score: pattern.length,
    match: (path: string) => matchPattern.ignores(path),
  };
}

function isSectionHeader(line: string): boolean {
  return line.startsWith('[') || line.startsWith('^[');
}
