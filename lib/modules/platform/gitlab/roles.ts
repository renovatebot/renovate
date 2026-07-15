import { regEx } from '../../../util/regex.ts';

// See: https://docs.gitlab.com/api/users/#list-projects-and-groups-that-a-user-is-a-member-of
const roleAccessLevels: Record<string, number> = {
  no_access: 0,
  minimal_access: 5,
  guest: 10,
  planner: 15,
  reporter: 20,
  developer: 30,
  maintainer: 40,
  owner: 50,
};

const roleRegex = regEx(/^@@(\w+)$/);

/**
 * Parse a GitLab CODEOWNERS role handle (`@@developer`, `@@maintainer`,
 * `@@owner`, etc) into its access level. Returns `null` when the handle is not a
 * recognized role, so `getRoleAccessLevel(x) !== null` doubles as a role check.
 */
export function getRoleAccessLevel(handle: string): number | null {
  const match = roleRegex.exec(handle);
  const level = match ? roleAccessLevels[match[1].toLowerCase()] : undefined;
  return level ?? null;
}
