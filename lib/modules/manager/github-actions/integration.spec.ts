import { codeBlock } from 'common-tags';
import * as httpMock from '~test/http-mock.ts';
import { partial } from '~test/util.ts';
import { getConfig } from '../../../config/defaults.ts';
import * as hostRules from '../../../util/host-rules.ts';
import { Result } from '../../../util/result.ts';
import * as lookup from '../../../workers/repository/process/lookup/index.ts';
import type { LookupUpdateConfig } from '../../../workers/repository/process/lookup/types.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { id as githubActionsVersioningId } from '../../versioning/github-actions/index.ts';
import type { PackageDependency } from '../types.ts';
import { extractPackageFile } from './index.ts';

describe('modules/manager/github-actions/integration', () => {
  describe('when using versioning=github-actions', () => {
    const getGithubTags = vi.spyOn(
      GithubTagsDatasource.prototype,
      'getReleases',
    );
    const getGithubDigest = vi.spyOn(
      GithubTagsDatasource.prototype,
      'getDigest',
    );

    let baseConfig: LookupUpdateConfig;

    beforeEach(() => {
      // TODO: fix types #22198
      baseConfig = partial<LookupUpdateConfig>(getConfig() as never);
      baseConfig.manager = 'github-actions';
    });

    afterEach(() => {
      httpMock.clear(false);
      hostRules.clear();
    });

    function makeConfig(dep: PackageDependency): LookupUpdateConfig {
      return {
        ...baseConfig,
        ...dep,
        currentValue: dep.currentValue ?? undefined,
        // isGetPkgReleasesConfig() requires a non-empty packageName, even though `extractPackageFile` does not set a `packageName` if it has the same value as `depName`
        packageName: dep.packageName ?? dep.depName!,
        // Override dep's default 'docker' versioning with 'github-actions', as if configured through packageRules
        versioning: githubActionsVersioningId,
      };
    }

    it('proposes major update when using tagged major, if a major is available', async () => {
      const workflow = codeBlock`
      on: push
      jobs:
        test:
          runs-on: ubuntu-latest
          steps:
            - uses: actions/checkout@v1
    `;

      const extracted = extractPackageFile(
        workflow,
        '.github/workflows/test.yml',
        {},
      );
      expect(extracted).not.toBeNull();

      const dep = extracted!.deps.find((d) => d.depName === 'actions/checkout');
      expect(dep).toBeDefined();

      getGithubTags.mockResolvedValueOnce({
        releases: [
          { version: 'v1.0.0' },
          // additional majors to show they're skipped, as expected
          { version: 'v2' },
          { version: 'v3' },
          // this will be used as it's the shortest match
          { version: 'v4' },
          // these are added to make it clear they won't be used
          { version: 'v4.0' },
          { version: 'v4.0.0' },
          { version: 'v4.1.0' },
        ],
      });

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(makeConfig(dep!)),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'major',
          hasAttestation: undefined,
          isBreaking: false,
          newMajor: 4,
          newMinor: 1,
          newPatch: 0,
          newValue: 'v4',
          newVersion: 'v4.1.0',
          updateType: 'major',
        },
      ]);
    });

    it('switches major-only version to major.minor if no major is available', async () => {
      const workflow = codeBlock`
      on: push
      jobs:
        test:
          runs-on: ubuntu-latest
          steps:
            - uses: actions/checkout@v1
    `;

      const extracted = extractPackageFile(
        workflow,
        '.github/workflows/test.yml',
        {},
      );
      expect(extracted).not.toBeNull();

      const dep = extracted!.deps.find((d) => d.depName === 'actions/checkout');
      expect(dep).toBeDefined();

      getGithubTags.mockResolvedValueOnce({
        releases: [
          { version: 'v1.0.0' },
          { version: 'v2' },
          { version: 'v3' },
          // no major
          { version: 'v4.1' },
          // this will not be used as a shorter version is available
          { version: 'v4.1.0' },
        ],
      });

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(makeConfig(dep!)),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'major',
          hasAttestation: undefined,
          isBreaking: false,
          newMajor: 4,
          newMinor: 1,
          newPatch: 0,
          newValue: 'v4.1',
          newVersion: 'v4.1.0',
          updateType: 'major',
        },
      ]);
    });

    it('proposes major and minor updates for tagged major.minor', async () => {
      const workflow = codeBlock`
      on: push
      jobs:
        test:
          runs-on: ubuntu-latest
          steps:
            - uses: actions/checkout@v1.2
    `;

      const extracted = extractPackageFile(
        workflow,
        '.github/workflows/test.yml',
        {},
      );
      expect(extracted).not.toBeNull();

      const dep = extracted!.deps.find((d) => d.depName === 'actions/checkout');
      expect(dep).toBeDefined();

      getGithubTags.mockResolvedValueOnce({
        releases: [
          { version: 'v1' },
          { version: 'v1.2.0' },
          { version: 'v1.6.0' },
          { version: 'v2.0.0' },
          { version: 'v3.0.0' },
          { version: 'v4.0.0' },
          { version: 'v4.1' },
          // this will not be used, as it's longer than what we're currently using
          { version: 'v4.1.0' },
        ],
      });

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(makeConfig(dep!)),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'non-major',
          hasAttestation: undefined,
          isBreaking: false,
          newMajor: 1,
          newMinor: 6,
          newPatch: 0,
          // a non-major bump gets a longer version, as there's no `v1.6`
          newValue: 'v1.6.0',
          newVersion: 'v1.6.0',
          updateType: 'minor',
        },
        {
          bucket: 'major',
          hasAttestation: undefined,
          isBreaking: false,
          newMajor: 4,
          newMinor: 1,
          newPatch: 0,
          newValue: 'v4.1',
          newVersion: 'v4.1.0',
          updateType: 'major',
        },
      ]);
    });

    it('proposes minor update for full semver', async () => {
      const workflow = codeBlock`
      on: push
      jobs:
        test:
          runs-on: ubuntu-latest
          steps:
            - uses: actions/checkout@v4.0.0
    `;

      const extracted = extractPackageFile(
        workflow,
        '.github/workflows/test.yml',
        {},
      );
      expect(extracted).not.toBeNull();

      const dep = extracted!.deps.find((d) => d.depName === 'actions/checkout');
      expect(dep).toBeDefined();

      getGithubTags.mockResolvedValueOnce({
        releases: [
          // won't be used, even though it's shorter than our current tagging
          { version: 'v4' },
          { version: 'v4.0.0' },
          { version: 'v4.1.0' },
          { version: 'v4.2.0' },
        ],
      });

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(makeConfig(dep!)),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'non-major',
          hasAttestation: undefined,
          isBreaking: false,
          newMajor: 4,
          newMinor: 2,
          newPatch: 0,
          newValue: 'v4.2.0',
          newVersion: 'v4.2.0',
          updateType: 'minor',
        },
      ]);
    });

    it('proposes updates for SHA-pinned action with major-only comment', async () => {
      const workflow = codeBlock`
      on: push
      jobs:
        build:
          runs-on: ubuntu-latest
          steps:
            - uses: actions/checkout@93cb6efe18208431cddfb8368fd83d5badbf9bfd # v5
    `;

      const extracted = extractPackageFile(
        workflow,
        '.github/workflows/ci-pinning.yml',
        {},
      );
      expect(extracted).not.toBeNull();

      const dep = extracted!.deps.find((d) => d.depName === 'actions/checkout');
      expect(dep).toBeDefined();

      getGithubTags.mockResolvedValueOnce({
        releases: [
          { version: 'v5.0.0' },
          { version: 'v5.1.0' },
          { version: 'v6.0.0' },
          { version: 'v6.1.0' },
        ],
      });
      // getDigest is called once per update (major version + digest update)
      getGithubDigest
        .mockResolvedValueOnce(
          'aaaaaaaabbbbbbbbccccccccddddddddeeeeeeee11111111',
        ) // v6.1.0
        .mockResolvedValueOnce(
          'ffffffffffffffffffffffffffffffffffffffff22222222',
        ); // digest (v5)

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(makeConfig(dep!)),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'major',
          hasAttestation: undefined,
          isBreaking: false,
          newDigest: 'aaaaaaaabbbbbbbbccccccccddddddddeeeeeeee11111111',
          newMajor: 6,
          newMinor: 1,
          newPatch: 0,
          newValue: 'v6.1.0',
          newVersion: 'v6.1.0',
          updateType: 'major',
        },
        {
          newDigest: 'ffffffffffffffffffffffffffffffffffffffff22222222',
          newValue: 'v5',
          updateType: 'digest',
        },
      ]);
    });

    it('proposes updates for SHA-pinned action with major.minor comment', async () => {
      const workflow = codeBlock`
      on: push
      jobs:
        build:
          runs-on: ubuntu-latest
          steps:
            - uses: actions/checkout@93cb6efe18208431cddfb8368fd83d5badbf9bfd # v5.0
    `;

      const extracted = extractPackageFile(
        workflow,
        '.github/workflows/ci-pinning.yml',
        {},
      );
      expect(extracted).not.toBeNull();

      const dep = extracted!.deps.find((d) => d.depName === 'actions/checkout');
      expect(dep).toBeDefined();

      getGithubTags.mockResolvedValueOnce({
        releases: [
          { version: 'v5.0.0' },
          { version: 'v5.1' },
          { version: 'v5.1.0' },
          { version: 'v6.0.0' },
          { version: 'v6.1.0' },
        ],
      });
      // getDigest is called once per update (major version + digest update)
      getGithubDigest
        .mockResolvedValueOnce(
          'bbbbbbbbcccccccccceeeeeeeeefffffaaaaaa1111111112',
        ) // v5.1.0
        .mockResolvedValueOnce(
          'aaaaaaaabbbbbbbbccccccccddddddddeeeeeeee11111111',
        ) // v6.1.0
        .mockResolvedValueOnce(
          'ffffffffffffffffffffffffffffffffffffffff22222222',
        ); // digest (v5)

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(makeConfig(dep!)),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'non-major',
          hasAttestation: undefined,
          isBreaking: false,
          newDigest: 'bbbbbbbbcccccccccceeeeeeeeefffffaaaaaa1111111112',
          newMajor: 5,
          newMinor: 1,
          newPatch: 0,
          newValue: 'v5.1',
          newVersion: 'v5.1.0',
          updateType: 'minor',
        },
        {
          bucket: 'major',
          hasAttestation: undefined,
          isBreaking: false,
          newDigest: 'aaaaaaaabbbbbbbbccccccccddddddddeeeeeeee11111111',
          newMajor: 6,
          newMinor: 1,
          newPatch: 0,
          newValue: 'v6.1.0',
          newVersion: 'v6.1.0',
          updateType: 'major',
        },
        {
          newDigest: 'ffffffffffffffffffffffffffffffffffffffff22222222',
          newValue: 'v5.0',
          updateType: 'digest',
        },
      ]);
    });

    it('proposes updates for SHA-pinned action with full semver comment', async () => {
      const workflow = codeBlock`
      on: push
      jobs:
        build:
          runs-on: ubuntu-latest
          steps:
            - uses: astral-sh/setup-uv@e06108dd0aef18192324c70427afc47652e63a82 # v7.5.0
    `;

      const extracted = extractPackageFile(
        workflow,
        '.github/workflows/ci-pinning-semver.yml',
        {},
      );
      expect(extracted).not.toBeNull();

      const dep = extracted!.deps.find(
        (d) => d.depName === 'astral-sh/setup-uv',
      );
      expect(dep).toBeDefined();

      getGithubTags.mockResolvedValueOnce({
        releases: [
          { version: 'v7.5.0' },
          { version: 'v7.6.0' },
          { version: 'v8.0.0' },
        ],
      });
      // getDigest is called once per update (minor + major + digest update)
      getGithubDigest
        .mockResolvedValueOnce(
          'aaaaaaaabbbbbbbbccccccccddddddddeeeeeeee11111111',
        ) // v7.6.0
        .mockResolvedValueOnce(
          'ffffffffffffffffffffffffffffffffffffffff22222222',
        ) // v8.0.0
        .mockResolvedValueOnce(
          '1111111122222222333333334444444455555555aaaaaaaa',
        ); // digest (v7.5.0)

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(makeConfig(dep!)),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'non-major',
          hasAttestation: undefined,
          isBreaking: false,
          newDigest: 'aaaaaaaabbbbbbbbccccccccddddddddeeeeeeee11111111',
          newMajor: 7,
          newMinor: 6,
          newPatch: 0,
          newValue: 'v7.6.0',
          newVersion: 'v7.6.0',
          updateType: 'minor',
        },
        {
          bucket: 'major',
          hasAttestation: undefined,
          isBreaking: false,
          newDigest: 'ffffffffffffffffffffffffffffffffffffffff22222222',
          newMajor: 8,
          newMinor: 0,
          newPatch: 0,
          newValue: 'v8.0.0',
          newVersion: 'v8.0.0',
          updateType: 'major',
        },
        {
          newDigest: '1111111122222222333333334444444455555555aaaaaaaa',
          newValue: 'v7.5.0',
          updateType: 'digest',
        },
      ]);
    });

    it('proposes minor and major updates for floating minor tag', async () => {
      const workflow = codeBlock`
      on: push
      jobs:
        build:
          runs-on: ubuntu-latest
          steps:
            - uses: actions/checkout@v4
            - uses: astral-sh/setup-uv@v7.5
    `;

      const extracted = extractPackageFile(
        workflow,
        '.github/workflows/ci-another.yml',
        {},
      );
      expect(extracted).not.toBeNull();

      const dep = extracted!.deps.find(
        (d) => d.depName === 'astral-sh/setup-uv',
      );
      expect(dep).toBeDefined();

      getGithubTags.mockResolvedValueOnce({
        releases: [
          { version: 'v7.5' },
          { version: 'v7.5.0' },
          { version: 'v7.5.1' },
          { version: 'v7.6' },
          { version: 'v7.6.0' },
          // for instance, now using Immutable Releases so requiring full SemVer
          { version: 'v8.0.0' },
          { version: 'v8.1.0' },
        ],
      });

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(makeConfig(dep!)),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'non-major',
          hasAttestation: undefined,
          isBreaking: false,
          newMajor: 7,
          newMinor: 6,
          newPatch: 0,
          newValue: 'v7.6',
          newVersion: 'v7.6.0',
          updateType: 'minor',
        },
        {
          bucket: 'major',
          hasAttestation: undefined,
          isBreaking: false,
          newMajor: 8,
          newMinor: 1,
          newPatch: 0,
          newValue: 'v8.1.0',
          newVersion: 'v8.1.0',
          updateType: 'major',
        },
      ]);
    });

    it('proposes no update for major, when only newer patch/minor releases exist', async () => {
      const workflow = codeBlock`
      on: push
      jobs:
        build:
          runs-on: ubuntu-latest
          steps:
            - uses: actions/checkout@v4
    `;

      const extracted = extractPackageFile(
        workflow,
        '.github/workflows/ci.yml',
        {},
      );
      expect(extracted).not.toBeNull();

      const dep = extracted!.deps.find((d) => d.depName === 'actions/checkout');
      expect(dep).toBeDefined();

      getGithubTags.mockResolvedValueOnce({
        releases: [
          { version: 'v4.0.0' },
          { version: 'v4.3.1' },
          // no v4.3 floating tag
        ],
      });

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(makeConfig(dep!)),
      ).unwrapOrThrow();

      expect(updates).toEqual([]);
    });

    it('proposes minor+major+digest updates for SHA-pinned with floating major comment', async () => {
      const workflow = codeBlock`
      on: push
      jobs:
        build:
          runs-on: ubuntu-latest
          steps:
            - uses: astral-sh/setup-uv@e06108dd0aef18192324c70427afc47652e63a82 # v7
    `;

      const extracted = extractPackageFile(
        workflow,
        '.github/workflows/ci-pinning-best-practices.yml',
        {},
      );
      expect(extracted).not.toBeNull();

      const dep = extracted!.deps.find(
        (d) => d.depName === 'astral-sh/setup-uv',
      );
      expect(dep).toBeDefined();

      getGithubTags.mockResolvedValueOnce({
        releases: [
          { version: 'v7.5.0' },
          { version: 'v7.6' },
          { version: 'v7.6.0' },
          { version: 'v8.0.0' },
          { version: 'v8.1.0' },
        ],
      });
      getGithubDigest
        .mockResolvedValueOnce(
          'aaaaaaaabbbbbbbbccccccccddddddddeeeeeeee11111111',
        ) // v8.1.0 major
        .mockResolvedValueOnce(
          'ffffffffffffffffffffffffffffffffffffffff22222222',
        ); // digest (v7)

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(makeConfig(dep!)),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'major',
          hasAttestation: undefined,
          isBreaking: false,
          newDigest: 'aaaaaaaabbbbbbbbccccccccddddddddeeeeeeee11111111',
          newMajor: 8,
          newMinor: 1,
          newPatch: 0,
          newValue: 'v8.1.0',
          newVersion: 'v8.1.0',
          updateType: 'major',
        },
        {
          newDigest: 'ffffffffffffffffffffffffffffffffffffffff22222222',
          newValue: 'v7',
          updateType: 'digest',
        },
      ]);
    });

    it('proposes no update for SHA-pinned when only patch version available and digest unchanged', async () => {
      const workflow = codeBlock`
      on: push
      jobs:
        build:
          runs-on: ubuntu-latest
          steps:
            - uses: actions/checkout@93cb6efe18208431cddfb8368fd83d5badbf9bfd # v5
    `;

      const extracted = extractPackageFile(
        workflow,
        '.github/workflows/ci-pinning.yml',
        {},
      );
      expect(extracted).not.toBeNull();

      const dep = extracted!.deps.find((d) => d.depName === 'actions/checkout');
      expect(dep).toBeDefined();

      getGithubTags.mockResolvedValueOnce({
        releases: [{ version: 'v5.0.0' }, { version: 'v5.0.1' }],
      });
      // the same SHA as we're already using
      getGithubDigest.mockResolvedValueOnce(
        '93cb6efe18208431cddfb8368fd83d5badbf9bfd',
      );

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(makeConfig(dep!)),
      ).unwrapOrThrow();

      expect(updates).toEqual([]);
    });

    it('preserves floating major tag when newer patch/minor versions exist with full semver', async () => {
      const workflow = codeBlock`
      on: push
      jobs:
        build:
          runs-on: ubuntu-latest
          steps:
            - uses: astral-sh/setup-uv@v7
    `;

      const extracted = extractPackageFile(
        workflow,
        '.github/workflows/ci.yml',
        {},
      );
      expect(extracted).not.toBeNull();

      const dep = extracted!.deps.find(
        (d) => d.depName === 'astral-sh/setup-uv',
      );
      expect(dep).toBeDefined();

      getGithubTags.mockResolvedValueOnce({
        releases: [
          { version: 'v7' },
          { version: 'v7.5.0' },
          { version: 'v7.6' },
          { version: 'v7.6.0' },
          { version: 'v8.0.0' },
          { version: 'v8.1.0' },
        ],
      });

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(makeConfig(dep!)),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'major',
          hasAttestation: undefined,
          isBreaking: false,
          newMajor: 8,
          newMinor: 1,
          newPatch: 0,
          newValue: 'v8.1.0',
          newVersion: 'v8.1.0',
          updateType: 'major',
        },
      ]);
    });

    it('preserves floating major tag when only floating minor tags exist', async () => {
      const workflow = codeBlock`
      on: push
      jobs:
        build:
          runs-on: ubuntu-latest
          steps:
            - uses: astral-sh/setup-uv@v7
    `;

      const extracted = extractPackageFile(
        workflow,
        '.github/workflows/ci.yml',
        {},
      );
      expect(extracted).not.toBeNull();

      const dep = extracted!.deps.find(
        (d) => d.depName === 'astral-sh/setup-uv',
      );
      expect(dep).toBeDefined();

      getGithubTags.mockResolvedValueOnce({
        releases: [{ version: 'v7' }, { version: 'v7.5' }, { version: 'v7.6' }],
      });

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(makeConfig(dep!)),
      ).unwrapOrThrow();

      expect(updates).toEqual([]);
    });

    it('migrates floating major tag to major.minor when only floating minor tags exist', async () => {
      const workflow = codeBlock`
      on: push
      jobs:
        build:
          runs-on: ubuntu-latest
          steps:
            - uses: astral-sh/setup-uv@v7
    `;

      const extracted = extractPackageFile(
        workflow,
        '.github/workflows/ci.yml',
        {},
      );
      expect(extracted).not.toBeNull();

      const dep = extracted!.deps.find(
        (d) => d.depName === 'astral-sh/setup-uv',
      );
      expect(dep).toBeDefined();

      getGithubTags.mockResolvedValueOnce({
        releases: [
          // no major
          { version: 'v7.5' },
          { version: 'v7.6' },
        ],
      });

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(makeConfig(dep!)),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'non-major',
          hasAttestation: undefined,
          isBreaking: false,
          newMajor: 7,
          newMinor: 6,
          newPatch: 0,
          newValue: 'v7.6',
          newVersion: 'v7.6',
          updateType: 'minor',
        },
      ]);
    });

    it('proposes minor update for floating minor tag without returning less-specific floating major', async () => {
      const workflow = codeBlock`
      on: push
      jobs:
        build:
          runs-on: ubuntu-latest
          steps:
            - uses: astral-sh/setup-uv@v7.5
    `;

      const extracted = extractPackageFile(
        workflow,
        '.github/workflows/ci.yml',
        {},
      );
      expect(extracted).not.toBeNull();

      const dep = extracted!.deps.find(
        (d) => d.depName === 'astral-sh/setup-uv',
      );
      expect(dep).toBeDefined();

      getGithubTags.mockResolvedValueOnce({
        releases: [
          { version: 'v7' },
          { version: 'v7.5.0' },
          { version: 'v7.6' },
          { version: 'v7.6.0' },
        ],
      });

      const { updates } = await Result.wrap(
        lookup.lookupUpdates(makeConfig(dep!)),
      ).unwrapOrThrow();

      expect(updates).toEqual([
        {
          bucket: 'non-major',
          hasAttestation: undefined,
          isBreaking: false,
          newMajor: 7,
          newMinor: 6,
          newPatch: 0,
          newValue: 'v7.6',
          newVersion: 'v7.6.0',
          updateType: 'minor',
        },
      ]);
    });

    it('handles multiple deps in one workflow', async () => {
      const workflow = codeBlock`
      on: push
      jobs:
        test:
          runs-on: ubuntu-latest
          steps:
            - uses: actions/checkout@v1
            - uses: actions/setup-node@v2
    `;

      const extracted = extractPackageFile(
        workflow,
        '.github/workflows/test.yml',
        {},
      );
      expect(extracted).not.toBeNull();

      const actionDeps = extracted!.deps.filter(
        (d) => d.datasource === GithubTagsDatasource.id,
      );
      expect(actionDeps).toHaveLength(2);

      getGithubTags
        .mockResolvedValueOnce({
          releases: [{ version: 'v1.0.0' }, { version: 'v4.0.0' }],
        })
        .mockResolvedValueOnce({
          releases: [{ version: 'v2.0.0' }, { version: 'v4.0.0' }],
        });

      const results = await Promise.all(
        actionDeps.map(async (dep) => {
          const { updates } = await Result.wrap(
            lookup.lookupUpdates(makeConfig(dep)),
          ).unwrapOrThrow();
          return { depName: dep.depName, updates };
        }),
      );

      expect(results).toEqual([
        {
          depName: 'actions/checkout',
          updates: [
            {
              bucket: 'major',
              hasAttestation: undefined,
              isBreaking: false,
              newMajor: 4,
              newMinor: 0,
              newPatch: 0,
              newValue: 'v4.0.0',
              newVersion: 'v4.0.0',
              updateType: 'major',
            },
          ],
        },
        {
          depName: 'actions/setup-node',
          updates: [
            {
              bucket: 'major',
              hasAttestation: undefined,
              isBreaking: false,
              newMajor: 4,
              newMinor: 0,
              newPatch: 0,
              newValue: 'v4.0.0',
              newVersion: 'v4.0.0',
              updateType: 'major',
            },
          ],
        },
      ]);
    });
  });
});
