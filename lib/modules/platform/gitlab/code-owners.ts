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
  // Find the last closing bracket to handle section names with approval counts
  const lastClosingBracketIndex = line.lastIndexOf(']');

  // Extract section name (including any approval counts)
  const sectionName = line.substring(0, lastClosingBracketIndex + 1);
  const remainingLine = line.substring(lastClosingBracketIndex + 1).trim();

  // Parse any default users after the section name
  const usernames = remainingLine ? remainingLine.split(regEx(/\s+/)) : [];

  return { name: sectionName, defaultUsers: usernames };
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
