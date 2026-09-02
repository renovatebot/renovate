interface DependencyCandidate {
  packageName: string;
  currentVersion: string;
  availableVersions: readonly string[];
}

interface VitePlusRelease {
  version: string;
  dependencies?: Record<string, string>;
}

interface PlannedUpdate {
  packageName: string;
  currentVersion: string;
  newVersion: string;
}

interface MissingParticipant {
  packageName: string;
  requiredVersion: string;
}

type Participant =
  | { kind: 'core'; dependency: DependencyCandidate }
  | { kind: 'vitest'; dependency: DependencyCandidate };

export type VitePlusCompatibilityPlan =
  | {
      kind: 'ready';
      vitePlusVersion: string;
      vitestVersion: string;
      updates: PlannedUpdate[];
    }
  | {
      kind: 'blocked';
      vitePlusVersion: string;
      reason:
        | 'missing-release-metadata'
        | 'missing-vitest-version'
        | 'unavailable-required-version';
      missingParticipants: MissingParticipant[];
    };

export type VitePlusCompatibilityResult =
  | { kind: 'not-applicable' }
  | {
      kind: 'planned';
      currentVitestVersion: string;
      plans: VitePlusCompatibilityPlan[];
    }
  | {
      kind: 'invalid-anchor';
      reason: 'missing-release-metadata' | 'missing-vitest-version';
    };

export interface VitePlusCompatibilityInput {
  dependencies: readonly DependencyCandidate[];
  vitePlusReleases: readonly VitePlusRelease[];
}

const VITE_PLUS_PACKAGE_NAME = 'vite-plus';
const VITE_PLUS_CORE_PACKAGE_NAME = '@voidzero-dev/vite-plus-core';

function getVitestVersion(
  release: VitePlusRelease | undefined,
): string | undefined {
  return release?.dependencies?.vitest;
}

function isVitestParticipant(packageName: string): boolean {
  return packageName === 'vitest' || packageName.startsWith('@vitest/');
}

function getParticipant(
  dependency: DependencyCandidate,
): Participant | undefined {
  if (dependency.packageName === VITE_PLUS_CORE_PACKAGE_NAME) {
    return { kind: 'core', dependency };
  }

  if (isVitestParticipant(dependency.packageName)) {
    return { kind: 'vitest', dependency };
  }

  return undefined;
}

function getRequiredVersion(
  participant: Participant,
  vitePlusVersion: string,
  vitestVersion: string,
): string {
  switch (participant.kind) {
    case 'core':
      return vitePlusVersion;
    case 'vitest':
      return vitestVersion;
  }
}

export function planVitePlusCompatibility({
  dependencies,
  vitePlusReleases,
}: VitePlusCompatibilityInput): VitePlusCompatibilityResult {
  const vitePlus = dependencies.find(
    ({ packageName }) => packageName === VITE_PLUS_PACKAGE_NAME,
  );
  if (!vitePlus) {
    return { kind: 'not-applicable' };
  }

  const releaseByVersion = new Map(
    vitePlusReleases.map((release) => [release.version, release]),
  );
  const currentRelease = releaseByVersion.get(vitePlus.currentVersion);
  if (!currentRelease) {
    return { kind: 'invalid-anchor', reason: 'missing-release-metadata' };
  }

  const currentVitestVersion = getVitestVersion(currentRelease);
  if (!currentVitestVersion) {
    return { kind: 'invalid-anchor', reason: 'missing-vitest-version' };
  }

  const participants = dependencies.flatMap((dependency) => {
    const participant = getParticipant(dependency);
    return participant ? [participant] : [];
  });

  const plans = vitePlus.availableVersions.map(
    (vitePlusVersion): VitePlusCompatibilityPlan => {
      const release = releaseByVersion.get(vitePlusVersion);
      if (!release) {
        return {
          kind: 'blocked',
          vitePlusVersion,
          reason: 'missing-release-metadata',
          missingParticipants: [],
        };
      }

      const vitestVersion = getVitestVersion(release);
      if (!vitestVersion) {
        return {
          kind: 'blocked',
          vitePlusVersion,
          reason: 'missing-vitest-version',
          missingParticipants: [],
        };
      }

      const updates: PlannedUpdate[] = [
        {
          packageName: VITE_PLUS_PACKAGE_NAME,
          currentVersion: vitePlus.currentVersion,
          newVersion: vitePlusVersion,
        },
      ];
      const missingParticipants: MissingParticipant[] = [];

      for (const participant of participants) {
        const requiredVersion = getRequiredVersion(
          participant,
          vitePlusVersion,
          vitestVersion,
        );
        const { dependency } = participant;
        if (dependency.currentVersion === requiredVersion) {
          continue;
        }

        if (!dependency.availableVersions.includes(requiredVersion)) {
          missingParticipants.push({
            packageName: dependency.packageName,
            requiredVersion,
          });
          continue;
        }

        updates.push({
          packageName: dependency.packageName,
          currentVersion: dependency.currentVersion,
          newVersion: requiredVersion,
        });
      }

      if (missingParticipants.length > 0) {
        return {
          kind: 'blocked',
          vitePlusVersion,
          reason: 'unavailable-required-version',
          missingParticipants,
        };
      }

      return {
        kind: 'ready',
        vitePlusVersion,
        vitestVersion,
        updates,
      };
    },
  );

  return { kind: 'planned', currentVitestVersion, plans };
}
