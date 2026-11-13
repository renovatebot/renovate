import { describe, expect, it } from 'vitest';
import type { Upgrade } from '../types.ts';
import { updateDependency } from './update.ts';

describe('modules/manager/nimble/update', () => {
  it('updates dependency in-place while preserving quotes and comments', () => {
    const fileContent = `
# Dependencies
requires "zippy >= 0.10.4" # fast compression
requires "checksums >= 0.1.0"
    `;

    const upgrade: Upgrade = {
      depName: 'zippy',
      currentValue: '>= 0.10.4',
      newValue: '0.11.0',
      replaceString: 'zippy >= 0.10.4',
    };

    const res = updateDependency({
      fileContent,
      packageFile: 'sample.nimble',
      upgrade,
    });

    expect(res).toContain('requires "zippy >= 0.11.0" # fast compression');
    expect(res).toContain('requires "checksums >= 0.1.0"');
  });

  it('updates multi-dependency lines without affecting siblings', () => {
    const fileContent = 'requires "zippy >= 0.10.4", "checksums >= 0.1.0"';

    const upgrade: Upgrade = {
      depName: 'zippy',
      currentValue: '>= 0.10.4',
      newValue: '0.11.0',
      replaceString: 'zippy >= 0.10.4',
    };

    const res = updateDependency({
      fileContent,
      packageFile: 'sample.nimble',
      upgrade,
    });

    expect(res).toBe('requires "zippy >= 0.11.0", "checksums >= 0.1.0"');
  });

  it('updates parenthesized requires declarations cleanly', () => {
    const fileContent = 'requires("zippy >= 0.10.4")';

    const upgrade: Upgrade = {
      depName: 'zippy',
      currentValue: '>= 0.10.4',
      newValue: '0.11.0',
      replaceString: 'zippy >= 0.10.4',
    };

    const res = updateDependency({
      fileContent,
      packageFile: 'sample.nimble',
      upgrade,
    });

    expect(res).toBe('requires("zippy >= 0.11.0")');
  });

  it('preserves single quotes when updating', () => {
    const fileContent = "requires 'yaml ^= 2.1.0'";

    const upgrade: Upgrade = {
      depName: 'yaml',
      currentValue: '^= 2.1.0',
      newValue: '^= 2.2.0',
      replaceString: 'yaml ^= 2.1.0',
    };

    const res = updateDependency({
      fileContent,
      packageFile: 'sample.nimble',
      upgrade,
    });

    expect(res).toBe("requires 'yaml ^= 2.2.0'");
  });

  it('updates bare version requirements without comparison operator', () => {
    const fileContent = 'requires "jester 0.5.0"';

    const upgrade: Upgrade = {
      depName: 'jester',
      currentValue: '0.5.0',
      newValue: '0.6.0',
      replaceString: 'jester 0.5.0',
    };

    const res = updateDependency({
      fileContent,
      packageFile: 'sample.nimble',
      upgrade,
    });

    expect(res).toBe('requires "jester 0.6.0"');
  });

  it('does not mutate commented lines matching replaceString', () => {
    const fileContent = `# requires "zippy >= 0.10.4"\nrequires "zippy >= 0.10.4"`;

    const upgrade: Upgrade = {
      depName: 'zippy',
      currentValue: '>= 0.10.4',
      newValue: '0.11.0',
      replaceString: 'zippy >= 0.10.4',
    };

    const res = updateDependency({
      fileContent,
      packageFile: 'sample.nimble',
      upgrade,
    });

    expect(res).toBe(
      `# requires "zippy >= 0.10.4"\nrequires "zippy >= 0.11.0"`,
    );
  });

  it('returns unchanged fileContent when newValue is undefined or empty', () => {
    const fileContent = 'requires "zippy >= 0.10.4"';
    const upgrade: Upgrade = {
      depName: 'zippy',
      currentValue: '>= 0.10.4',
      newValue: '',
      replaceString: 'zippy >= 0.10.4',
    };

    const res = updateDependency({
      fileContent,
      packageFile: 'sample.nimble',
      upgrade,
    });

    expect(res).toBe(fileContent);
  });

  it('synthesizes updatedItem when replaceString does not contain currentValue', () => {
    const fileContent = 'requires "zippy"';
    const upgrade: Upgrade = {
      depName: 'zippy',
      currentValue: '',
      newValue: '0.11.0',
      replaceString: 'zippy',
    };

    const res = updateDependency({
      fileContent,
      packageFile: 'sample.nimble',
      upgrade,
    });

    expect(res).toBe('requires "zippy >= 0.11.0"');
  });

  it('falls back to regex matching when replaceString is not in fileContent', () => {
    const fileContent = 'requires "zippy >= 0.10.4"';
    const upgrade: Upgrade = {
      depName: 'zippy',
      currentValue: '>= 0.10.4',
      newValue: '0.11.0',
      replaceString: 'nonexistent-string',
    };

    const res = updateDependency({
      fileContent,
      packageFile: 'sample.nimble',
      upgrade,
    });

    expect(res).toBe('requires "zippy >= 0.11.0"');
  });

  it('falls back to replace when replaceString is only in a commented line', () => {
    const fileContent = '# requires "zippy >= 0.10.4"';
    const upgrade: Upgrade = {
      depName: 'zippy',
      currentValue: '>= 0.10.4',
      newValue: '0.11.0',
      replaceString: 'zippy >= 0.10.4',
    };

    const res = updateDependency({
      fileContent,
      packageFile: 'sample.nimble',
      upgrade,
    });

    expect(res).toBe('# requires "zippy >= 0.11.0"');
  });

  it('strips leading v/V from newValue to prevent invalid requirement strings', () => {
    const fileContent = 'requires "zippy >= 0.10.4"';
    const upgrade: Upgrade = {
      depName: 'zippy',
      currentValue: '>= 0.10.4',
      newValue: 'v0.14.1',
      replaceString: 'zippy >= 0.10.4',
    };

    const res = updateDependency({
      fileContent,
      packageFile: 'sample.nimble',
      upgrade,
    });

    expect(res).toBe('requires "zippy >= 0.14.1"');
  });

  it('strips leading V with uppercase from newValue', () => {
    const fileContent = 'requires "chronos >= 4.2.0"';
    const upgrade: Upgrade = {
      depName: 'chronos',
      currentValue: '>= 4.2.0',
      newValue: 'V4.3.0',
      replaceString: 'chronos >= 4.2.0',
    };

    const res = updateDependency({
      fileContent,
      packageFile: 'sample.nimble',
      upgrade,
    });

    expect(res).toBe('requires "chronos >= 4.3.0"');
  });

  it('strips leading v when newValue includes comparison operator', () => {
    const fileContent = 'requires "zippy >= 0.10.4"';
    const upgrade: Upgrade = {
      depName: 'zippy',
      currentValue: '>= 0.10.4',
      newValue: '>= v0.14.1',
      replaceString: 'zippy >= 0.10.4',
    };

    const res = updateDependency({
      fileContent,
      packageFile: 'sample.nimble',
      upgrade,
    });

    expect(res).toBe('requires "zippy >= 0.14.1"');
  });

  it('updates taskRequires declarations and strips leading v', () => {
    const fileContent = 'taskRequires "test", "chronos >= 4.2.2"';
    const upgrade: Upgrade = {
      depName: 'chronos',
      currentValue: '>= 4.2.2',
      newValue: 'v4.3.0',
      replaceString: 'chronos >= 4.2.2',
    };

    const res = updateDependency({
      fileContent,
      packageFile: 'sample.nimble',
      upgrade,
    });

    expect(res).toBe('taskRequires "test", "chronos >= 4.3.0"');
  });

  it('updates parenthesized taskRequires declarations', () => {
    const fileContent = 'taskRequires("test", "testament >= 0.1.0")';
    const upgrade: Upgrade = {
      depName: 'testament',
      currentValue: '>= 0.1.0',
      newValue: '0.2.0',
      replaceString: 'testament >= 0.1.0',
    };

    const res = updateDependency({
      fileContent,
      packageFile: 'sample.nimble',
      upgrade,
    });

    expect(res).toBe('taskRequires("test", "testament >= 0.2.0")');
  });

  it('preserves compound range bounds when newValue contains &', () => {
    const fileContent = 'requires "typestates >= 0.14.0 & < 0.15.0"';
    const upgrade: Upgrade = {
      depName: 'typestates',
      currentValue: '>= 0.14.0 & < 0.15.0',
      newValue: '>= 0.14.1 & < 0.15.0',
      replaceString: 'typestates >= 0.14.0 & < 0.15.0',
    };

    const res = updateDependency({
      fileContent,
      packageFile: 'sample.nimble',
      upgrade,
    });

    expect(res).toBe('requires "typestates >= 0.14.1 & < 0.15.0"');
  });

  it('falls back to regex replacement when newValue already has an operator', () => {
    const fileContent = 'requires "typestates >= 0.14.0 & < 0.15.0"';
    const upgrade: Upgrade = {
      depName: 'typestates',
      currentValue: '>= 0.14.0 & < 0.15.0',
      newValue: '>= 0.14.1 & < 0.15.0',
      replaceString: 'nonexistent',
    };

    const res = updateDependency({
      fileContent,
      packageFile: 'sample.nimble',
      upgrade,
    });

    expect(res).toBe('requires "typestates >= 0.14.1 & < 0.15.0"');
  });
});
