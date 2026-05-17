import { codeBlock } from 'common-tags';
import { _extractPackageFile } from './extract.ts';
import type { KasDump } from './schema.ts';

const kasHeadTracking = codeBlock`
  header:
    version: 1

  build_system: isar

  repos:
    meta-test:
      path: meta-test/
      layers:
        .:
    isar:
      url: https://github.com/ilbers/isar.git
      commit: d63a1cbae6f737aa843d00d8812547fe7b87104a
      layers:
        meta:
        meta-isar:
`;

const kasBranchCommit = codeBlock`
  header:
    version: 1

  build_system: isar

  repos:
    meta-test:
      path: meta-test/
      layers:
        .:
    isar:
      url: https://github.com/ilbers/isar.git
      branch: next
      commit: d63a1cbae6f737aa843d00d8812547fe7b87104a
      layers:
        meta:
        meta-isar:
`;

const kasTag = codeBlock`
  header:
    version: 1

  build_system: isar

  repos:
    meta-test:
      path: meta-test/
      layers:
        .:
    isar:
      url: https://github.com/ilbers/isar.git
      tag: v0.0.1
      layers:
        meta:
        meta-isar:
`;

const kasTagCommit = codeBlock`
  header:
    version: 1

  build_system: isar

  repos:
    meta-test:
      path: meta-test/
      layers:
        .:
    isar:
      url: https://github.com/ilbers/isar.git
      tag: v0.0.1
      commit: d63a1cbae6f737aa843d00d8812547fe7b87104a
      layers:
        meta:
        meta-isar:
`;

const isarCommitSha = 'd63a1cbae6f737aa843d00d8812547fe7b87104a';
const isarTag = 'v0.0.1';
const isarBranch = 'next';
const isarUrl = 'https://github.com/ilbers/isar.git';

function makeDump(
  repos: KasDump['repos'],
  overrides?: KasDump['overrides'],
): KasDump {
  return {
    header: { version: 1 },
    repos,
    overrides,
  } as KasDump;
}

describe('modules/manager/kas/extract-package-file', () => {
  it('returns null for invalid YAML', () => {
    const dump = makeDump({});
    const result = _extractPackageFile(
      '{{invalid yaml',
      'kas.yml',
      dump,
      undefined,
    );
    expect(result).toBeNull();
  });

  it('returns null when no repos section exists', () => {
    const dump = makeDump({});
    const content = 'header:\n  version: 1\n';
    const result = _extractPackageFile(content, 'kas.yml', dump, undefined);
    expect(result).toBeNull();
  });

  it('extracts head-tracking dependency (commit only)', () => {
    const dump = makeDump({
      isar: {
        url: isarUrl,
        commit: isarCommitSha,
      },
    });
    const result = _extractPackageFile(
      kasHeadTracking,
      'kas.yml',
      dump,
      undefined,
    );
    expect(result).toMatchObject({
      deps: [
        {
          currentDigest: isarCommitSha,
          currentValue: undefined,
          datasource: 'git-refs',
          packageName: isarUrl,
          versioning: undefined,
        },
      ],
    });
    expect(result!.deps).toHaveLength(1);
  });

  it('extracts branch + commit dependency', () => {
    const dump = makeDump({
      isar: {
        url: isarUrl,
        commit: isarCommitSha,
        branch: isarTag,
      },
    });
    const result = _extractPackageFile(
      kasBranchCommit,
      'kas.yml',
      dump,
      undefined,
    );
    expect(result).toMatchObject({
      deps: [
        {
          currentDigest: isarCommitSha,
          currentValue: isarTag,
          datasource: 'git-refs',
          packageName: isarUrl,
          versioning: 'loose',
        },
      ],
    });
    expect(result!.deps).toHaveLength(1);
  });

  it('extracts tag-only dependency', () => {
    const dump = makeDump({
      isar: {
        url: isarUrl,
        tag: isarTag,
      },
    });
    const result = _extractPackageFile(kasTag, 'kas.yml', dump, undefined);
    expect(result).toMatchObject({
      deps: [
        {
          currentDigest: undefined,
          currentValue: isarTag,
          datasource: 'git-tags',
          packageName: isarUrl,
        },
      ],
    });
    expect(result!.deps).toHaveLength(1);
  });

  it('extracts tag + commit dependency', () => {
    const dump = makeDump({
      isar: {
        url: isarUrl,
        commit: isarCommitSha,
        tag: isarTag,
      },
    });
    const result = _extractPackageFile(
      kasTagCommit,
      'kas.yml',
      dump,
      undefined,
    );
    expect(result).toMatchObject({
      deps: [
        {
          currentDigest: isarCommitSha,
          currentValue: isarTag,
          datasource: 'git-tags',
          packageName: isarUrl,
        },
      ],
    });
    expect(result!.deps).toHaveLength(1);
  });

  it('skips repo not present in dump', () => {
    const dump = makeDump({});
    const result = _extractPackageFile(
      kasHeadTracking,
      'kas.yml',
      dump,
      undefined,
    );
    expect(result).toBeNull();
  });

  it('skips mercurial repos', () => {
    const content = codeBlock`
      header:
        version: 1
      repos:
        hg-repo:
          url: https://example.com/repo
          type: hg
          commit: abc123
    `;
    const dump = makeDump({
      'hg-repo': {
        url: 'https://example.com/repo',
        type: 'hg',
        commit: 'abc123',
      },
    });
    const result = _extractPackageFile(content, 'kas.yml', dump, undefined);
    expect(result).toBeNull();
  });

  it('skips when URL in file does not match dump', () => {
    const dump = makeDump({
      isar: {
        url: 'https://example.com/different-repo.git',
        commit: isarCommitSha,
      },
    });
    const result = _extractPackageFile(
      kasHeadTracking,
      'kas.yml',
      dump,
      undefined,
    );
    expect(result).toBeNull();
  });

  it('skips when commit does not match dump', () => {
    const dump = makeDump({
      isar: {
        url: isarUrl,
        commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      },
    });
    const result = _extractPackageFile(
      kasHeadTracking,
      'kas.yml',
      dump,
      undefined,
    );
    expect(result).toBeNull();
  });

  it('skips when no repo URL found for non-lock file', () => {
    const content = codeBlock`
      header:
        version: 1
      repos:
        local-repo:
          commit: abc123
    `;
    const dump = makeDump({
      'local-repo': {
        commit: 'abc123',
      },
    });
    const result = _extractPackageFile(content, 'kas.yml', dump, undefined);
    expect(result).toBeNull();
  });

  it('skips when both branch and tag are defined in dump', () => {
    const dump = makeDump({
      isar: {
        url: isarUrl,
        commit: isarCommitSha,
        branch: 'main',
        tag: 'v1.0.0',
      },
    });
    const result = _extractPackageFile(
      kasHeadTracking,
      'kas.yml',
      dump,
      undefined,
    );
    expect(result).toBeNull();
  });

  it('uses overrides commit from dump when available', () => {
    const overriddenCommit = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const content = codeBlock`
      header:
        version: 1
      repos:
        isar:
          url: ${isarUrl}
          commit: ${overriddenCommit}
    `;
    const dump = makeDump(
      {
        isar: {
          url: isarUrl,
          commit: isarCommitSha,
        },
      },
      {
        repos: {
          isar: { commit: overriddenCommit },
        },
      },
    );
    const result = _extractPackageFile(content, 'kas.yml', dump, undefined);
    expect(result).toMatchObject({
      deps: [
        {
          currentDigest: overriddenCommit,
          packageName: isarUrl,
          datasource: 'git-refs',
        },
      ],
    });
  });

  it('extracts dependencies from lock file overrides section', () => {
    const lockContent = codeBlock`
      overrides:
        repos:
          isar:
            commit: ${isarCommitSha}
    `;
    const dump = makeDump({
      isar: {
        url: isarUrl,
        commit: isarCommitSha,
      },
    });
    const result = _extractPackageFile(
      lockContent,
      'project.lock.yml',
      dump,
      undefined,
    );
    expect(result).toMatchObject({
      deps: [
        {
          currentDigest: isarCommitSha,
          datasource: 'git-refs',
          packageName: isarUrl,
        },
      ],
    });
  });

  it('returns null for lock file without overrides section', () => {
    const lockContent = codeBlock`
      some_key:
        repos:
          isar:
            commit: ${isarCommitSha}
    `;
    const dump = makeDump({
      isar: {
        url: isarUrl,
        commit: isarCommitSha,
      },
    });
    const result = _extractPackageFile(
      lockContent,
      'project.lock.yml',
      dump,
      undefined,
    );
    expect(result).toBeNull();
  });

  it('includes replaceString from YAML source range', () => {
    const dump = makeDump({
      isar: {
        url: isarUrl,
        commit: isarCommitSha,
      },
    });
    const result = _extractPackageFile(
      kasHeadTracking,
      'kas.yml',
      dump,
      undefined,
    );
    expect(result!.deps[0].replaceString).toBeDefined();
    expect(result!.deps[0].replaceString).toContain(isarUrl);
    expect(result!.deps[0].replaceString).toContain(isarCommitSha);
  });

  it('returns null when branch and commit is overriden', () => {
    const overriddenBranch = 'overridden-branch';
    const overriddenCommit = 'overridden-commit';
    const dump = makeDump({
      isar: {
        url: isarUrl,
        commit: overriddenCommit,
        branch: overriddenBranch,
      },
    });
    const result = _extractPackageFile(
      kasBranchCommit,
      'kas.yml',
      dump,
      undefined,
    );
    expect(result).toBeNull();
  });

  it('returns null when tag and commit is overriden', () => {
    const overriddenTag = 'overridden-tag';
    const overriddenCommit = 'overridden-commit';
    const dump = makeDump({
      isar: {
        url: isarUrl,
        commit: overriddenCommit,
        tag: overriddenTag,
      },
    });
    const result = _extractPackageFile(
      kasTagCommit,
      'kas.yml',
      dump,
      undefined,
    );
    expect(result).toBeNull();
  });

  it('returns only the commit when branch is overridden', () => {
    const overriddenBranch = 'overridden-branch';
    const dump = makeDump({
      isar: {
        url: isarUrl,
        commit: isarCommitSha,
        branch: overriddenBranch,
      },
    });
    const result = _extractPackageFile(
      kasBranchCommit,
      'kas.yml',
      dump,
      undefined,
    );
    expect(result).toMatchObject({
      deps: [
        {
          currentDigest: isarCommitSha,
          currentValue: overriddenBranch,
          datasource: 'git-refs',
          packageName: isarUrl,
        },
      ],
    });
  });

  it('returns null when commit is overridden and no tag present', () => {
    const overriddenCommit = 'overridden-commit';
    const dump = makeDump({
      isar: {
        url: isarUrl,
        commit: overriddenCommit,
        branch: isarBranch,
      },
    });
    const result = _extractPackageFile(
      kasBranchCommit,
      'kas.yml',
      dump,
      undefined,
    );
    expect(result).toBeNull();
  });

  it('returns only the commit when tag is overridden', () => {
    const overriddenTag = 'overridden-tag';
    const dump = makeDump({
      isar: {
        url: isarUrl,
        commit: isarCommitSha,
        tag: overriddenTag,
      },
    });
    const result = _extractPackageFile(
      kasTagCommit,
      'kas.yml',
      dump,
      undefined,
    );
    expect(result).toMatchObject({
      deps: [
        {
          currentDigest: isarCommitSha,
          currentValue: overriddenTag,
          datasource: 'git-tags',
          packageName: isarUrl,
        },
      ],
    });
  });

  it('returns only the tag when commit is overridden', () => {
    const overriddenCommit = 'overridden-commit';
    const dump = makeDump({
      isar: {
        url: isarUrl,
        commit: overriddenCommit,
        tag: isarTag,
      },
    });
    const result = _extractPackageFile(
      kasTagCommit,
      'kas.yml',
      dump,
      undefined,
    );
    expect(result).toMatchObject({
      deps: [
        {
          currentDigest: undefined,
          currentValue: isarTag,
          datasource: 'git-tags',
          packageName: isarUrl,
        },
      ],
    });
  });
});
