import { isNullOrUndefined, isPlainObject, isString } from '@sindresorhus/is';
import { dequal } from 'dequal';
import upath from 'upath';
import { z } from 'zod/v4';
import { GlobalConfig } from '../../../config/global.ts';
import { TEMPORARY_ERROR } from '../../../constants/error-messages.ts';
import { logger } from '../../../logger/index.ts';
import { ExternalHostError } from '../../../types/errors/external-host-error.ts';
import { coerceArray } from '../../../util/array.ts';
import { parseJsonc } from '../../../util/common.ts';
import { isDynamicInstall } from '../../../util/exec/containerbase.ts';
import { exec } from '../../../util/exec/index.ts';
import type { ToolConstraint } from '../../../util/exec/types.ts';
import {
  readLocalFile,
  withSystemTempDir,
  writeLocalFile,
} from '../../../util/fs/index.ts';
import { getFile } from '../../../util/git/index.ts';
import type { FileAddition } from '../../../util/git/types.ts';
import { coerceObject } from '../../../util/object.ts';
import { regEx } from '../../../util/regex.ts';
import { parseSingleYaml } from '../../../util/yaml.ts';
import * as npmVersioning from '../../versioning/npm/index.ts';
import type {
  ArtifactNotice,
  PackageDependency,
  PackageFile,
  PostUpdateConfig,
  UpdateArtifact,
  UpdateArtifactsResult,
  Upgrade,
} from '../types.ts';
import { pnpmWorkspaceOverrides } from './dep-types.ts';
import type { AdditionalPackageFiles } from './post-update/types.ts';
import type { NpmManagerData } from './types.ts';

const MAX_MANIFEST_BYTES = 1024 * 1024;
const MAX_PROTOCOL_BYTES = 16 * 1024 * 1024;
const MAX_PLAN_BYTES = MAX_PROTOCOL_BYTES * 2 + MAX_MANIFEST_BYTES;
const MAX_MANIFESTS = 256;
const VITE_PLUS_PACKAGE_NAME = 'vite-plus';
const VITE_PLUS_CORE_PACKAGE_NAME = '@voidzero-dev/vite-plus-core';
const VITE_PLUS_NODE_CONSTRAINT = '^20.19.0 || ^22.18.0 || >=24.11.0';
const MINIMUM_VITE_PLUS_VERSION = '0.3.1';
const overrideParentDelimiter = regEx(/[^ |@]>/);
const npmAliasPattern = regEx(
  /^npm:(?<packageName>(?:@[^/]+\/)?[^@]+)@(?<version>.+)$/,
);

const Replacement = z
  .object({
    path: z.string().min(1),
    kind: z.enum(['packageJson', 'pnpmWorkspace', 'yarnRc']),
    before: z.string().max(MAX_MANIFEST_BYTES),
    after: z.string().max(MAX_MANIFEST_BYTES),
  })
  .strict();

const SyncVersionsPlan = z
  .object({
    schemaVersion: z.literal(1),
    tool: z
      .object({
        name: z.literal('vite-plus'),
        version: z.string().min(1),
      })
      .strict(),
    workspace: z.literal('.'),
    replacements: z.array(Replacement).max(MAX_MANIFESTS),
  })
  .strict();

type ManifestKind = z.infer<typeof Replacement>['kind'];
type SyncVersionsPlan = z.infer<typeof SyncVersionsPlan>;

interface ManifestSnapshot {
  path: string;
  kind: ManifestKind;
  contents: string;
}

interface WorkspacePackageFiles {
  root: string;
  packageFiles: Partial<PackageFile<NpmManagerData>>[];
}

interface ValidationState {
  changedValues: number;
}

interface NpmAlias {
  packageName: string;
  version: string;
}

interface DependencyVersionChange {
  packageName: string;
  version: string;
}

interface ManifestDependency extends DependencyVersionChange {
  file: string;
  depType: string;
  changed: boolean;
}

interface ValidatedPlan {
  plan: SyncVersionsPlan;
  dependencies: ManifestDependency[];
}

interface MutableUpgrade extends Upgrade<NpmManagerData> {
  displayTo?: string;
  isBreaking?: boolean;
  newMinor?: number;
  newPatch?: number;
  prettyNewVersion?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return isPlainObject(value);
}

function isManagedPackage(packageName: string | undefined): boolean {
  if (
    packageName === VITE_PLUS_PACKAGE_NAME ||
    packageName === VITE_PLUS_CORE_PACKAGE_NAME ||
    packageName === 'vitest'
  ) {
    return true;
  }

  return (
    packageName?.startsWith('@vitest/') === true &&
    packageName !== '@vitest/eslint-plugin' &&
    packageName !== '@vitest/coverage-c8'
  );
}

function isVitestPackage(packageName: string): boolean {
  return packageName === 'vitest' || packageName.startsWith('@vitest/');
}

function effectivePackageName(
  dependency: Pick<PackageDependency, 'depName' | 'packageName'>,
): string | undefined {
  return dependency.packageName ?? dependency.depName;
}

function getWorkspaceRoot(
  packageFile: Partial<PackageFile<NpmManagerData>>,
): string | undefined {
  const lockFile =
    packageFile.managerData?.pnpmLockFile ??
    packageFile.managerData?.yarnLock ??
    packageFile.managerData?.npmLock;
  if (lockFile) {
    return upath.dirname(lockFile);
  }
  if (packageFile.packageFile) {
    return upath.dirname(packageFile.packageFile);
  }
  return undefined;
}

function groupPackageFiles(
  packageFiles: AdditionalPackageFiles,
): WorkspacePackageFiles[] {
  const groups = new Map<string, Partial<PackageFile<NpmManagerData>>[]>();

  for (const packageFile of coerceArray(packageFiles.npm)) {
    const root = getWorkspaceRoot(packageFile);
    if (!root) {
      continue;
    }
    const group = coerceArray(groups.get(root));
    group.push(packageFile);
    groups.set(root, group);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([root, groupedPackageFiles]) => ({
      root,
      packageFiles: groupedPackageFiles,
    }));
}

function getUpgradeRoot(
  upgrade: Upgrade<NpmManagerData>,
  packageRootByPath: Map<string, string>,
): string | undefined {
  const lockFile =
    upgrade.managerData?.pnpmLockFile ??
    upgrade.managerData?.yarnLock ??
    upgrade.managerData?.npmLock;
  if (lockFile) {
    return upath.dirname(lockFile);
  }
  return upgrade.packageFile
    ? packageRootByPath.get(upgrade.packageFile)
    : undefined;
}

function getRelevantUpgrades(
  upgrades: Upgrade<NpmManagerData>[],
  workspace: WorkspacePackageFiles,
  packageRootByPath: Map<string, string>,
): Upgrade<NpmManagerData>[] {
  return upgrades.filter(
    (upgrade) =>
      isManagedPackage(effectivePackageName(upgrade)) &&
      getUpgradeRoot(upgrade, packageRootByPath) === workspace.root,
  );
}

function exactVersion(value: string | null | undefined): string | undefined {
  return value && npmVersioning.isVersion(value) ? value : undefined;
}

function plannerToolConstraints(vitePlusVersion: string): ToolConstraint[] {
  return [
    { toolName: 'node', constraint: VITE_PLUS_NODE_CONSTRAINT },
    { toolName: 'vp', constraint: vitePlusVersion },
  ];
}

function canInstallPlanner(): boolean {
  return GlobalConfig.get('binarySource') === 'docker' || isDynamicInstall();
}

function plannerNotice(
  workspace: WorkspacePackageFiles,
  message: string,
): ArtifactNotice {
  return {
    file: upath.join(
      workspace.root === '.' ? '' : workspace.root,
      'package.json',
    ),
    message,
  };
}

function resolveVitePlusVersion(
  workspace: WorkspacePackageFiles,
  upgrades: Upgrade<NpmManagerData>[],
): string {
  const upgradedVersions = upgrades
    .filter(
      (upgrade) => effectivePackageName(upgrade) === VITE_PLUS_PACKAGE_NAME,
    )
    .map((upgrade) => exactVersion(upgrade.newVersion))
    .filter((version): version is string => version !== undefined);

  const installedVersions = workspace.packageFiles.flatMap((packageFile) =>
    coerceArray(packageFile.deps)
      .filter(
        (dependency) =>
          effectivePackageName(dependency) === VITE_PLUS_PACKAGE_NAME,
      )
      .map(
        (dependency) =>
          exactVersion(dependency.lockedVersion) ??
          exactVersion(dependency.currentVersion),
      )
      .filter((version): version is string => version !== undefined),
  );

  const versions = new Set(
    upgradedVersions.length > 0 ? upgradedVersions : installedVersions,
  );
  if (versions.size !== 1) {
    throw new Error(
      `Vite+ version reconciliation requires one exact Vite+ version in workspace ${workspace.root}`,
    );
  }
  return [...versions][0];
}

async function readManifestSnapshot(
  path: string,
  kind: ManifestKind,
): Promise<ManifestSnapshot | undefined> {
  const contents = await readLocalFile(path, 'utf8');
  if (isNullOrUndefined(contents)) {
    // Extracted manifests exist on disk, so a missing one means the read failed.
    if (kind !== 'pnpmWorkspace') {
      throw new Error(`Cannot read Vite+ manifest ${path}`);
    }
    return undefined;
  }
  if (Buffer.byteLength(contents) > MAX_MANIFEST_BYTES) {
    throw new Error(`Vite+ manifest exceeds the protocol limit: ${path}`);
  }
  return { path, kind, contents };
}

function packageFileKind(path: string | undefined): ManifestKind | undefined {
  if (path?.endsWith('package.json')) {
    return 'packageJson';
  }
  if (path?.endsWith('.yarnrc.yml')) {
    return 'yarnRc';
  }
  return undefined;
}

async function collectManifestSnapshots(
  workspace: WorkspacePackageFiles,
): Promise<ManifestSnapshot[]> {
  const paths = new Map<string, ManifestKind>();
  for (const packageFile of workspace.packageFiles) {
    const kind = packageFileKind(packageFile.packageFile);
    if (kind && packageFile.packageFile) {
      paths.set(packageFile.packageFile, kind);
    }
  }
  const pnpmWorkspacePath = upath.join(
    workspace.root === '.' ? '' : workspace.root,
    'pnpm-workspace.yaml',
  );
  paths.set(pnpmWorkspacePath, 'pnpmWorkspace');

  const snapshots = (
    await Promise.all(
      [...paths.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([path, kind]) => readManifestSnapshot(path, kind)),
    )
  ).filter((snapshot): snapshot is ManifestSnapshot => snapshot !== undefined);

  if (snapshots.length > MAX_MANIFESTS) {
    throw new Error(
      `Vite+ workspace ${workspace.root} exceeds the manifest count limit`,
    );
  }
  return snapshots;
}

function parseManifest(
  kind: ManifestKind,
  contents: string,
): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed =
      kind === 'packageJson' ? parseJsonc(contents) : parseSingleYaml(contents);
  } catch {
    throw new Error(`Vite+ returned an invalid ${kind} manifest`);
  }
  if (!isRecord(parsed)) {
    throw new Error(`Vite+ returned an invalid ${kind} manifest`);
  }
  return parsed;
}

function extractOverrideTargetName(key: string): string {
  let target = key.trim();
  for (
    let delimiter = target.search(overrideParentDelimiter);
    delimiter !== -1;
    delimiter = target.search(overrideParentDelimiter)
  ) {
    target = target.slice(delimiter + 2).trim();
  }
  if (target.includes('/')) {
    const segments = target.split('/');
    const last = segments.at(-1)!;
    const scope = segments.at(-2);
    target = scope?.startsWith('@') ? `${scope}/${last}` : last;
  }
  const nameStart = target.startsWith('@') ? target.indexOf('/') + 1 : 0;
  const versionAt = target.indexOf('@', nameStart);
  return versionAt > 0 ? target.slice(0, versionAt) : target;
}

function dependencyNameForPath(
  kind: ManifestKind,
  path: readonly string[],
): string | undefined {
  if (kind === 'packageJson') {
    if (path[0] === 'overrides' && path.length >= 2) {
      const selector = path.at(-1) === '.' ? path.at(-2) : path.at(-1);
      return extractOverrideTargetName(selector!);
    }
    if (
      path.length === 2 &&
      [
        'dependencies',
        'devDependencies',
        'optionalDependencies',
        'resolutions',
        'catalog',
      ].includes(path[0])
    ) {
      return path[0] === 'resolutions'
        ? extractOverrideTargetName(path[1])
        : path[1];
    }
    const isPnpmOverride = path[0] === 'pnpm' && path[1] === 'overrides';
    const isWorkspaceCatalog =
      path[0] === 'workspaces' && path[1] === 'catalog';
    const isNestedDependency =
      isPnpmOverride || path[0] === 'catalogs' || isWorkspaceCatalog;
    if (path.length === 3 && isNestedDependency) {
      return path[0] === 'pnpm' ? extractOverrideTargetName(path[2]) : path[2];
    }
    if (
      path.length === 4 &&
      path[0] === 'workspaces' &&
      path[1] === 'catalogs'
    ) {
      return path[3];
    }
    return undefined;
  }

  if (path.length === 2 && path[0] === 'catalog') {
    return path[1];
  }
  if (path.length === 3 && path[0] === 'catalogs') {
    return path[2];
  }
  if (
    kind === 'pnpmWorkspace' &&
    path.length === 2 &&
    path[0] === 'overrides'
  ) {
    return extractOverrideTargetName(path[1]);
  }
  return undefined;
}

function parseNpmAlias(value: string): NpmAlias | undefined {
  const match = npmAliasPattern.exec(value);
  if (!match?.groups) {
    return undefined;
  }
  return {
    packageName: match.groups.packageName,
    version: match.groups.version,
  };
}

function managedDependencyVersion(
  kind: ManifestKind,
  path: readonly string[],
  before: unknown,
  after: unknown,
): DependencyVersionChange | undefined {
  if (!isString(before) || !isString(after)) {
    return undefined;
  }

  const declaredPackageName = dependencyNameForPath(kind, path);
  if (!declaredPackageName) {
    return undefined;
  }

  const beforeAlias = parseNpmAlias(before);
  const afterAlias = parseNpmAlias(after);
  if (beforeAlias || afterAlias) {
    if (
      !beforeAlias ||
      !afterAlias ||
      beforeAlias.packageName !== afterAlias.packageName ||
      !isManagedPackage(afterAlias.packageName) ||
      !npmVersioning.isValid(beforeAlias.version) ||
      !npmVersioning.isVersion(afterAlias.version)
    ) {
      return undefined;
    }
    return {
      packageName: afterAlias.packageName,
      version: afterAlias.version,
    };
  }

  if (
    !isManagedPackage(declaredPackageName) ||
    !npmVersioning.isValid(before) ||
    !npmVersioning.isVersion(after)
  ) {
    return undefined;
  }
  return { packageName: declaredPackageName, version: after };
}

function validateChangedValue(
  kind: ManifestKind,
  path: readonly string[],
  before: unknown,
  after: unknown,
  vitePlusVersion: string,
  state: ValidationState,
): void {
  const change = managedDependencyVersion(kind, path, before, after);
  if (!change) {
    throw new Error('Vite+ attempted an unsupported manifest change');
  }
  const { packageName, version } = change;

  const isVitePlus =
    packageName === VITE_PLUS_PACKAGE_NAME ||
    packageName === VITE_PLUS_CORE_PACKAGE_NAME;
  if (isVitePlus && version !== vitePlusVersion) {
    throw new Error('Vite+ returned an unexpected Vite+ version');
  }

  state.changedValues += 1;
}

function validateManifestTree(
  kind: ManifestKind,
  before: unknown,
  after: unknown,
  path: readonly string[],
  vitePlusVersion: string,
  state: ValidationState,
): void {
  if (dequal(before, after)) {
    return;
  }

  if (isRecord(before) && isRecord(after)) {
    const beforeKeys = Object.keys(before).sort();
    const afterKeys = Object.keys(after).sort();
    if (!dequal(beforeKeys, afterKeys)) {
      throw new Error('Vite+ attempted to add or remove manifest keys');
    }
    for (const key of beforeKeys) {
      validateManifestTree(
        kind,
        before[key],
        after[key],
        [...path, key],
        vitePlusVersion,
        state,
      );
    }
    return;
  }

  validateChangedValue(kind, path, before, after, vitePlusVersion, state);
}

function dependencyTypeForPath(
  kind: ManifestKind,
  path: readonly string[],
): string {
  if (kind === 'packageJson') {
    return path[0] === 'pnpm' ? 'pnpm.overrides' : path[0];
  }
  if (path[0] === 'overrides') {
    return pnpmWorkspaceOverrides;
  }
  const manager = kind === 'yarnRc' ? 'yarn' : 'pnpm';
  const catalog = path[0] === 'catalog' ? 'default' : path[1];
  return `${manager}.catalog.${catalog}`;
}

function collectManifestDependencies(
  snapshot: Pick<ManifestSnapshot, 'path' | 'kind'>,
  before: unknown,
  after: unknown,
  path: readonly string[],
): ManifestDependency[] {
  if (isRecord(before) && isRecord(after)) {
    return Object.keys(after).flatMap((key) =>
      collectManifestDependencies(snapshot, before[key], after[key], [
        ...path,
        key,
      ]),
    );
  }
  const declaredPackageName = dependencyNameForPath(snapshot.kind, path);
  if (!declaredPackageName || !isString(after)) {
    return [];
  }
  const alias = parseNpmAlias(after);
  const packageName = alias?.packageName ?? declaredPackageName;
  const version = alias?.version ?? after;
  if (!isManagedPackage(packageName) || !npmVersioning.isValid(version)) {
    return [];
  }
  if (!npmVersioning.isVersion(version)) {
    throw new Error('Vite+ returned a non-exact managed version');
  }
  return [
    {
      packageName,
      version,
      file: snapshot.path,
      depType: dependencyTypeForPath(snapshot.kind, path),
      changed: before !== after,
    },
  ];
}

function parseAndValidatePlan(
  stdout: string,
  snapshots: ManifestSnapshot[],
  vitePlusVersion: string,
): ValidatedPlan {
  let rawPlan: unknown;
  try {
    rawPlan = JSON.parse(stdout);
  } catch {
    throw new Error('Vite+ returned invalid sync plan JSON');
  }
  const result = SyncVersionsPlan.safeParse(rawPlan);
  if (!result.success) {
    throw new Error('Vite+ returned an invalid sync plan');
  }
  const plan = result.data;
  if (plan.tool.version !== vitePlusVersion) {
    throw new Error(
      'Vite+ sync plan version does not match the selected release',
    );
  }

  const snapshotsByPath = new Map(
    snapshots.map((snapshot) => [snapshot.path, snapshot]),
  );
  const replacementPaths = new Set<string>();
  const state: ValidationState = { changedValues: 0 };
  for (const replacement of plan.replacements) {
    if (replacementPaths.has(replacement.path)) {
      throw new Error('Vite+ returned duplicate replacement');
    }
    replacementPaths.add(replacement.path);

    const snapshot = snapshotsByPath.get(replacement.path);
    if (!snapshot || snapshot.kind !== replacement.kind) {
      throw new Error('Vite+ returned an unknown manifest');
    }
    if (replacement.before !== snapshot.contents) {
      throw new Error('Vite+ sync plan is stale');
    }

    const changedValuesBefore = state.changedValues;
    validateManifestTree(
      replacement.kind,
      parseManifest(replacement.kind, replacement.before),
      parseManifest(replacement.kind, replacement.after),
      [],
      vitePlusVersion,
      state,
    );
    if (state.changedValues === changedValuesBefore) {
      throw new Error(
        `Vite+ returned a replacement without dependency changes`,
      );
    }
  }

  const replacements = new Map(
    plan.replacements.map(({ path, after }) => [path, after]),
  );
  const dependencies = snapshots.flatMap((snapshot) =>
    collectManifestDependencies(
      snapshot,
      parseManifest(snapshot.kind, snapshot.contents),
      parseManifest(
        snapshot.kind,
        replacements.get(snapshot.path) ?? snapshot.contents,
      ),
      [],
    ),
  );
  for (const { packageName, version } of dependencies) {
    const isVitePlus =
      packageName === VITE_PLUS_PACKAGE_NAME ||
      packageName === VITE_PLUS_CORE_PACKAGE_NAME;
    if (isVitePlus && version !== vitePlusVersion) {
      throw new Error('Vite+ returned an unexpected Vite+ version');
    }
  }
  const vitestVersions = new Set(
    dependencies
      .filter(({ packageName }) => isVitestPackage(packageName))
      .map(({ version }) => version),
  );
  if (vitestVersions.size > 1) {
    throw new Error('Vite+ returned inconsistent Vitest ecosystem versions');
  }
  return { plan, dependencies };
}

function getAlignedUpdateType(
  currentMajor: number | null,
  currentMinor: number | null,
  newMajor: number,
  newMinor: number,
): 'major' | 'minor' | 'patch' {
  if (newMajor !== currentMajor) {
    return 'major';
  }
  if (newMinor !== currentMinor) {
    return 'minor';
  }
  return 'patch';
}

function updateUpgradeMetadata(
  upgrades: Upgrade<NpmManagerData>[],
  dependencies: ManifestDependency[],
): void {
  for (const upgrade of upgrades as MutableUpgrade[]) {
    const version = dependencies.find((dependency) =>
      matchesUpgrade(dependency, upgrade),
    )?.version;
    if (!version) {
      continue;
    }
    upgrade.newVersion = version;
    upgrade.newValue = version;
    upgrade.displayTo = version;
    upgrade.prettyNewVersion = `v${version}`;
    upgrade.newMajor = npmVersioning.api.getMajor(version)!;
    upgrade.newMinor = npmVersioning.api.getMinor(version)!;
    upgrade.newPatch = npmVersioning.api.getPatch(version)!;
    if (upgrade.currentValue === version) {
      continue;
    }
    if (upgrade.currentVersion === version) {
      upgrade.updateType = 'pin';
      upgrade.isBreaking = false;
      continue;
    }
    if (
      upgrade.currentVersion &&
      npmVersioning.isVersion(upgrade.currentVersion)
    ) {
      const currentMajor = npmVersioning.api.getMajor(upgrade.currentVersion);
      const currentMinor = npmVersioning.api.getMinor(upgrade.currentVersion);
      upgrade.updateType = getAlignedUpdateType(
        currentMajor,
        currentMinor,
        upgrade.newMajor,
        upgrade.newMinor,
      );
      upgrade.isBreaking = npmVersioning.api.isBreaking!(
        upgrade.currentVersion,
        version,
      );
    }
  }
}

function matchesUpgrade(
  dependency: ManifestDependency,
  upgrade: Upgrade,
): boolean {
  return (
    dependency.file === upgrade.packageFile &&
    dependency.depType === upgrade.depType &&
    dependency.packageName === effectivePackageName(upgrade)
  );
}

export async function hasReconciledVitePlusTargets({
  branchName,
  upgrades,
}: Pick<PostUpdateConfig, 'branchName' | 'upgrades'>): Promise<boolean> {
  const dependenciesByFile = new Map<string, ManifestDependency[]>();
  for (const upgrade of upgrades) {
    if (
      upgrade.manager !== 'npm' ||
      upgrade.depType === 'peerDependencies' ||
      !isManagedPackage(effectivePackageName(upgrade))
    ) {
      continue;
    }
    const path = upgrade.packageFile;
    if (!path) {
      return false;
    }
    let dependencies = dependenciesByFile.get(path);
    if (!dependencies) {
      const kind =
        upath.basename(path) === 'pnpm-workspace.yaml'
          ? 'pnpmWorkspace'
          : packageFileKind(path);
      if (!kind) {
        continue;
      }
      const contents = await getFile(path, branchName, { throwOnError: true });
      if (!contents || Buffer.byteLength(contents) > MAX_MANIFEST_BYTES) {
        return false;
      }
      try {
        const manifest = parseManifest(kind, contents);
        dependencies = collectManifestDependencies(
          { path, kind },
          manifest,
          manifest,
          [],
        );
      } catch {
        logger.debug(
          { packageFile: path },
          'Cannot verify existing Vite+ dependency targets',
        );
        return false;
      }
      dependenciesByFile.set(path, dependencies);
    }
    const matches = dependencies.filter((dependency) =>
      matchesUpgrade(dependency, upgrade),
    );
    if (
      !matches.length ||
      matches.some((dependency) => dependency.version !== upgrade.newVersion)
    ) {
      return false;
    }
  }
  return true;
}

function additionalAlignmentNotices(
  dependencies: ManifestDependency[],
  upgrades: Upgrade<NpmManagerData>[],
): ArtifactNotice[] {
  const alignments = new Map<string, Set<string>>();
  for (const dependency of dependencies) {
    if (
      !dependency.changed ||
      upgrades.some((upgrade) => matchesUpgrade(dependency, upgrade))
    ) {
      continue;
    }
    const changes = alignments.get(dependency.file) ?? new Set<string>();
    changes.add(`${dependency.packageName} to ${dependency.version}`);
    alignments.set(dependency.file, changes);
  }
  return [...alignments.entries()].map(([file, changes]) => ({
    file,
    message: `Vite+ aligned ${[...changes].join(', ')} for compatibility.`,
  }));
}

async function runPlanner(
  workspace: WorkspacePackageFiles,
  snapshots: ManifestSnapshot[],
  vitePlusVersion: string,
): Promise<ValidatedPlan> {
  const request = JSON.stringify({
    schemaVersion: 1,
    workspace: '.',
    manifests: snapshots.map(({ path, kind, contents }) => ({
      path,
      kind,
      contents,
    })),
  });
  if (Buffer.byteLength(request) > MAX_PROTOCOL_BYTES) {
    throw new Error(
      `Vite+ workspace ${workspace.root} exceeds the protocol limit`,
    );
  }

  return withSystemTempDir('renovate-vp-', async (workingDirectory) => {
    const result = await exec(
      [{ command: ['vp', 'sync-versions', '--json'] }],
      {
        cwd: workingDirectory,
        docker: {},
        input: request,
        maxBuffer: MAX_PLAN_BYTES,
        redactOutput: true,
        toolConstraints: plannerToolConstraints(vitePlusVersion),
      },
    ).catch((error: unknown) => {
      const isTemporaryError =
        error instanceof Error && error.message === TEMPORARY_ERROR;
      if (error instanceof ExternalHostError || isTemporaryError) {
        throw error;
      }
      logger.debug(
        { workspace: workspace.root, vitePlusVersion },
        'Vite+ planner execution failed',
      );
      throw new Error('Vite+ planner execution failed');
    });
    return parseAndValidatePlan(result.stdout, snapshots, vitePlusVersion);
  });
}

function latestPackageFile(
  { packageFileName, newPackageFileContent }: UpdateArtifact<NpmManagerData>,
  artifacts: UpdateArtifactsResult[],
): FileAddition {
  let contents: string | Buffer = newPackageFileContent;
  for (const { file } of artifacts) {
    if (
      file?.type === 'addition' &&
      file.path === packageFileName &&
      !isNullOrUndefined(file.contents)
    ) {
      contents = file.contents;
    }
  }
  return { type: 'addition', path: packageFileName, contents };
}

async function reconcileWorkspace(
  {
    config,
    packageFileName,
    newPackageFileContent,
  }: UpdateArtifact<NpmManagerData>,
  artifacts: UpdateArtifactsResult[],
): Promise<UpdateArtifactsResult[]> {
  if (!config.postUpdateOptions?.includes('vitePlusSyncVersions')) {
    return [];
  }
  const packageFiles = config.packageFiles as
    AdditionalPackageFiles | undefined;
  const workspaces = groupPackageFiles(coerceObject(packageFiles));
  const workspace = workspaces.find(({ packageFiles }) =>
    packageFiles.some(({ packageFile }) => packageFile === packageFileName),
  );
  if (!workspace) {
    return [];
  }
  const packageRootByPath = new Map<string, string>();
  for (const packageFile of workspace.packageFiles) {
    if (packageFile.packageFile) {
      packageRootByPath.set(packageFile.packageFile, workspace.root);
    }
  }
  const upgrades = getRelevantUpgrades(
    coerceArray(config.upgrades) as Upgrade<NpmManagerData>[],
    workspace,
    packageRootByPath,
  );
  const hasVitePlus = workspace.packageFiles.some((packageFile) =>
    packageFile.deps?.some(
      (dependency) =>
        effectivePackageName(dependency) === VITE_PLUS_PACKAGE_NAME,
    ),
  );
  if (!upgrades.length || !hasVitePlus) {
    return [];
  }
  if (!canInstallPlanner()) {
    const message =
      'Vite+ version reconciliation requires Renovate dynamic tool installation; leaving declared versions unchanged.';
    logger.warn(
      {
        binarySource: GlobalConfig.get('binarySource'),
        workspace: workspace.root,
      },
      message,
    );
    return [{ notice: plannerNotice(workspace, message) }];
  }
  const vitePlusVersion = resolveVitePlusVersion(workspace, upgrades);
  if (
    npmVersioning.api.isGreaterThan(MINIMUM_VITE_PLUS_VERSION, vitePlusVersion)
  ) {
    return [
      {
        notice: plannerNotice(
          workspace,
          `Vite+ ${vitePlusVersion} predates version reconciliation support; declared versions were left unchanged.`,
        ),
      },
    ];
  }
  const latestFiles = new Map<string, string | Buffer>([
    [packageFileName, newPackageFileContent],
  ]);
  for (const { file } of artifacts) {
    if (file?.type === 'addition' && !isNullOrUndefined(file.contents)) {
      latestFiles.set(file.path, file.contents);
    }
  }
  for (const [path, contents] of latestFiles) {
    await writeLocalFile(path, contents);
  }
  const snapshots = await collectManifestSnapshots(workspace);
  if (snapshots.length === 0) {
    throw new Error(`No Vite+ manifests found in workspace ${workspace.root}`);
  }
  const { plan, dependencies } = await runPlanner(
    workspace,
    snapshots,
    vitePlusVersion,
  );
  // A later call must replace earlier artifacts even when its managed versions already match.
  const replacements = new Map<string, FileAddition>([
    [
      packageFileName,
      {
        type: 'addition',
        path: packageFileName,
        contents: latestFiles.get(packageFileName)!,
      },
    ],
  ]);
  for (const { path, after } of plan.replacements) {
    await writeLocalFile(path, after);
    replacements.set(path, { type: 'addition', path, contents: after });
  }
  const results: UpdateArtifactsResult[] = [...replacements.values()].map(
    (file) => ({ file }),
  );
  updateUpgradeMetadata(upgrades, dependencies);
  results.push(
    ...additionalAlignmentNotices(dependencies, upgrades).map((notice) => ({
      notice,
    })),
  );
  logger.debug(
    {
      workspace: workspace.root,
      vitePlusVersion,
      replacementCount: plan.replacements.length,
    },
    'Reconciled Vite+ managed dependency versions',
  );
  return results;
}

export async function reconcileVitePlusVersions(
  update: UpdateArtifact<NpmManagerData>,
  artifacts: UpdateArtifactsResult[],
): Promise<UpdateArtifactsResult[]> {
  try {
    return await reconcileWorkspace(update, artifacts);
  } catch (err) {
    const isTemporaryError =
      err instanceof Error && err.message === TEMPORARY_ERROR;
    if (err instanceof ExternalHostError || isTemporaryError) {
      throw err;
    }
    const message =
      err instanceof Error ? err.message : 'Unknown Vite+ reconciliation error';
    return [
      // An earlier call may have returned this file reconciled from older contents.
      { file: latestPackageFile(update, artifacts) },
      { artifactError: { fileName: update.packageFileName, stderr: message } },
    ];
  }
}
