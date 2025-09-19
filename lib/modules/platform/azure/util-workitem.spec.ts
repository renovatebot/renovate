import { describe, expect, it } from 'vitest';
import { getWorkItemTitle } from './util-workitem';

describe('modules/platform/azure/util-workitem', () => {
  it('returns the raw title if not a dependency dashboard', () => {
    expect(getWorkItemTitle('Some Issue', 'project/repo')).toBe('Some Issue');
  });

  it('returns the raw title if dependency dashboard and already prefixed', () => {
    expect(
      getWorkItemTitle('[repo] Dependency Dashboard', 'project/repo'),
    ).toBe('[repo] Dependency Dashboard');
  });

  it('prefixes dependency dashboard title with repo name if not already prefixed', () => {
    expect(getWorkItemTitle('Dependency Dashboard', 'project/repo')).toBe(
      '[repo] Dependency Dashboard',
    );
  });

  it('handles repository names with slashes', () => {
    expect(getWorkItemTitle('Dependency Dashboard', 'org/project/repo')).toBe(
      '[repo] Dependency Dashboard',
    );
  });

  it('does not double prefix if repo name is already present', () => {
    expect(
      getWorkItemTitle('[repo] Dependency Dashboard', 'org/project/repo'),
    ).toBe('[repo] Dependency Dashboard');
  });

  it('handles titles with apostrophes', () => {
    expect(getWorkItemTitle("Dependency Dashboard's", 'project/repo')).toBe(
      "[repo] Dependency Dashboard's",
    );
  });
});
