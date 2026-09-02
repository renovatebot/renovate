import { planVitePlusCompatibility } from './vite-plus.ts';

describe('workers/repository/process/compatibility/vite-plus', () => {
  it('plans the Vite+ 0.3.0 toolchain as one compatible update', () => {
    const result = planVitePlusCompatibility({
      dependencies: [
        {
          packageName: 'vite-plus',
          currentVersion: '0.2.9',
          availableVersions: ['0.3.0'],
        },
        {
          packageName: '@voidzero-dev/vite-plus-core',
          currentVersion: '0.2.9',
          availableVersions: ['0.3.0'],
        },
        {
          packageName: '@vitest/browser-playwright',
          currentVersion: '4.1.10',
          availableVersions: ['4.1.11'],
        },
        {
          packageName: '@vitest/coverage-v8',
          currentVersion: '4.1.10',
          availableVersions: ['4.1.11'],
        },
      ],
      vitePlusReleases: [
        { version: '0.2.9', dependencies: { vitest: '4.1.10' } },
        { version: '0.3.0', dependencies: { vitest: '4.1.11' } },
      ],
    });

    expect(result).toEqual({
      kind: 'planned',
      currentVitestVersion: '4.1.10',
      plans: [
        {
          kind: 'ready',
          vitePlusVersion: '0.3.0',
          vitestVersion: '4.1.11',
          updates: [
            {
              packageName: 'vite-plus',
              currentVersion: '0.2.9',
              newVersion: '0.3.0',
            },
            {
              packageName: '@voidzero-dev/vite-plus-core',
              currentVersion: '0.2.9',
              newVersion: '0.3.0',
            },
            {
              packageName: '@vitest/browser-playwright',
              currentVersion: '4.1.10',
              newVersion: '4.1.11',
            },
            {
              packageName: '@vitest/coverage-v8',
              currentVersion: '4.1.10',
              newVersion: '4.1.11',
            },
          ],
        },
      ],
    });
  });

  it('does not plan provider-only updates ahead of the current Vite+ release', () => {
    const result = planVitePlusCompatibility({
      dependencies: [
        {
          packageName: 'vite-plus',
          currentVersion: '0.3.0',
          availableVersions: [],
        },
        {
          packageName: '@vitest/coverage-v8',
          currentVersion: '4.1.11',
          availableVersions: ['4.1.12'],
        },
      ],
      vitePlusReleases: [
        { version: '0.3.0', dependencies: { vitest: '4.1.11' } },
      ],
    });

    expect(result).toEqual({
      kind: 'planned',
      currentVitestVersion: '4.1.11',
      plans: [],
    });
  });

  it('allows a Vite+ release that keeps the current Vitest version', () => {
    const result = planVitePlusCompatibility({
      dependencies: [
        {
          packageName: 'vite-plus',
          currentVersion: '0.3.0',
          availableVersions: ['0.3.1'],
        },
        {
          packageName: '@vitest/coverage-v8',
          currentVersion: '4.1.11',
          availableVersions: ['4.1.12'],
        },
      ],
      vitePlusReleases: [
        { version: '0.3.0', dependencies: { vitest: '4.1.11' } },
        { version: '0.3.1', dependencies: { vitest: '4.1.11' } },
      ],
    });

    expect(result).toEqual({
      kind: 'planned',
      currentVitestVersion: '4.1.11',
      plans: [
        {
          kind: 'ready',
          vitePlusVersion: '0.3.1',
          vitestVersion: '4.1.11',
          updates: [
            {
              packageName: 'vite-plus',
              currentVersion: '0.3.0',
              newVersion: '0.3.1',
            },
          ],
        },
      ],
    });
  });

  it('blocks an anchor update when an installed provider cannot reach the required version', () => {
    const result = planVitePlusCompatibility({
      dependencies: [
        {
          packageName: 'vite-plus',
          currentVersion: '0.2.9',
          availableVersions: ['0.3.0'],
        },
        {
          packageName: '@vitest/coverage-v8',
          currentVersion: '4.1.10',
          availableVersions: ['4.1.12'],
        },
      ],
      vitePlusReleases: [
        { version: '0.2.9', dependencies: { vitest: '4.1.10' } },
        { version: '0.3.0', dependencies: { vitest: '4.1.11' } },
      ],
    });

    expect(result).toEqual({
      kind: 'planned',
      currentVitestVersion: '4.1.10',
      plans: [
        {
          kind: 'blocked',
          vitePlusVersion: '0.3.0',
          reason: 'unavailable-required-version',
          missingParticipants: [
            {
              packageName: '@vitest/coverage-v8',
              requiredVersion: '4.1.11',
            },
          ],
        },
      ],
    });
  });

  it('does not affect projects without Vite+', () => {
    const result = planVitePlusCompatibility({
      dependencies: [
        {
          packageName: 'vitest',
          currentVersion: '4.1.11',
          availableVersions: ['4.1.12'],
        },
      ],
      vitePlusReleases: [],
    });

    expect(result).toEqual({ kind: 'not-applicable' });
  });

  it.each([
    {
      name: 'missing current release metadata',
      releases: [],
      expectedReason: 'missing-release-metadata',
    },
    {
      name: 'missing bundled Vitest metadata',
      releases: [{ version: '0.3.0' }],
      expectedReason: 'missing-vitest-version',
    },
  ] as const)(
    'rejects an invalid anchor with $name',
    ({ releases, expectedReason }) => {
      const result = planVitePlusCompatibility({
        dependencies: [
          {
            packageName: 'vite-plus',
            currentVersion: '0.3.0',
            availableVersions: [],
          },
        ],
        vitePlusReleases: releases,
      });

      expect(result).toEqual({
        kind: 'invalid-anchor',
        reason: expectedReason,
      });
    },
  );

  it.each([
    {
      name: 'missing candidate release metadata',
      releases: [{ version: '0.2.9', dependencies: { vitest: '4.1.10' } }],
      expectedReason: 'missing-release-metadata',
    },
    {
      name: 'missing candidate Vitest metadata',
      releases: [
        { version: '0.2.9', dependencies: { vitest: '4.1.10' } },
        { version: '0.3.0' },
      ],
      expectedReason: 'missing-vitest-version',
    },
  ] as const)(
    'blocks a candidate with $name',
    ({ releases, expectedReason }) => {
      const result = planVitePlusCompatibility({
        dependencies: [
          {
            packageName: 'vite-plus',
            currentVersion: '0.2.9',
            availableVersions: ['0.3.0'],
          },
        ],
        vitePlusReleases: releases,
      });

      expect(result).toEqual({
        kind: 'planned',
        currentVitestVersion: '4.1.10',
        plans: [
          {
            kind: 'blocked',
            vitePlusVersion: '0.3.0',
            reason: expectedReason,
            missingParticipants: [],
          },
        ],
      });
    },
  );
});
