import ignore from 'ignore';
import { regEx } from '../../util/regex.ts';
import type {
  FileOwnerRule,
  Platform,
  PlatformDefaultedMethod,
} from './types.ts';

function extractOwnersFromLine(line: string): FileOwnerRule {
  const [pattern, ...usernames] = line.split(regEx(/\s+/));
  const matchPattern = ignore().add(pattern);
  return {
    usernames,
    pattern,
    score: pattern.length,
    match: (path: string) => matchPattern.ignores(path),
  };
}

/**
 * Behaviour used for platforms which do not implement these members themselves.
 * `setPlatformApi` merges the selected platform on top of these, so consumers
 * never have to guard the call.
 */
export const platformDefaults: Pick<Platform, PlatformDefaultedMethod> = {
  getIssue: () => Promise.resolve(null),
  getVulnerabilityAlerts: () => Promise.resolve([]),
  getBranchForceRebase: () => Promise.resolve(false),
  refreshPr: () => Promise.resolve(),
  expandGroupMembers: (reviewersOrAssignees) =>
    Promise.resolve(reviewersOrAssignees),
  filterUnavailableUsers: (users) => Promise.resolve(users),
  labelCharLimit: () => 50,
  extractRulesFromCodeOwnersLines: (cleanedLines) =>
    cleanedLines.map(extractOwnersFromLine),
};
