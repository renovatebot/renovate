import { isNullOrUndefined, isPlainObject, isString } from '@sindresorhus/is';
import { dequal } from 'dequal';
import upath from 'upath';
import { z } from 'zod/v4';
import { GlobalConfig } from '../../../../config/global.ts';
import { logger } from '../../../../logger/index.ts';
import { coerceArray } from '../../../../util/array.ts';
import { parseJsonc } from '../../../../util/common.ts';
import { isDynamicInstall } from '../../../../util/exec/containerbase.ts';
import { ExecError } from '../../../../util/exec/exec-error.ts';
import { exec } from '../../../../util/exec/index.ts';
import type { ToolConstraint } from '../../../../util/exec/types.ts';
import { withSystemTempDir } from '../../../../util/fs/index.ts';
import { getFile } from '../../../../util/git/index.ts';
import type { FileAddition, FileChange } from '../../../../util/git/types.ts';
import { regEx } from '../../../../util/regex.ts';
import { parseSingleYaml } from '../../../../util/yaml.ts';
import * as npmVersioning from '../../../versioning/npm/index.ts';
import type {
  ArtifactNotice,
  PackageFile,
  PostUpdateConfig,
  Upgrade,
} from '../../types.ts';
import type { NpmManagerData } from '../types.ts';
import type { AdditionalPackageFiles } from './types.ts';

const MAX_MANIFEST_BYTES = 1024 * 1024;
const MAX_PROTOCOL_BYTES = 16 * 1024 * 1024;
const MAX_PLAN_BYTES = MAX_PROTOCOL_BYTES * 2 + MAX_MANIFEST_BYTES;
const MAX_MANIFESTS = 256;
const VITE_PLUS_PACKAGE_NAME = 'vite-plus';
const VITE_PLUS_CORE_PACKAGE_NAME = '@voidzero-dev/vite-plus-core';
const VITE_PLUS_NODE_CONSTRAINT = '^20.19.0 || ^22.18.0 || >=24.11.0';
// Stable machine-readable marker emitted by Containerbase's vp installer.
const VP_SYNC_VERSIONS_UNAVAILABLE =
  'CONTAINERBASE_VP_SYNC_VERSIONS_UNAVAILABLE';
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
  baselineContents: string | null;
}

interface WorkspacePackageFiles {
  root: string;
  packageFiles: Partial<PackageFile<NpmManagerData>>[];
}

interface ValidationState {
  changedValues: number;
  vitestVersion?: string;
}

interface NpmAlias {
  packageName: string;
  version: string;
}

interface DependencyVersionChange {
  packageName: string;
  version: string;
}

interface MutableUpgrade extends Upgrade<NpmManagerData> {
  displayTo?: string;
  isBreaking?: boolean;
  newMinor?: number;
  newPatch?: number;
  prettyNewVersion?: string;
}

function isUnsupportedPlannerError(
  error: unknown,
  vitePlusVersion: string,
): boolean {
  const marker = `${VP_SYNC_VERSIONS_UNAVAILABLE}:${vitePlusVersion}`;
  if (error instanceof ExecError) {
    return [error.message, error.stdout, error.stderr].some((value) =>
      value.includes(marker),
    );
  }
  return false;
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
  config: PostUpdateConfig<NpmManagerData>,
  workspace: WorkspacePackageFiles,
  packageRootByPath: Map<string, string>,
): Upgrade<NpmManagerData>[] {
  return coerceArray(config.upgrades).filter(
    (upgrade) =>
      isManagedPackage(upgrade.packageName ?? upgrade.depName) &&
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
    .filter((upgrade) => upgrade.depName === VITE_PLUS_PACKAGE_NAME)
    .map((upgrade) => exactVersion(upgrade.newVersion))
    .filter((version): version is string => version !== undefined);

  const installedVersions = workspace.packageFiles.flatMap((packageFile) =>
    coerceArray(packageFile.deps)
      .filter((dependency) => dependency.depName === VITE_PLUS_PACKAGE_NAME)
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

function findAddition(
  files: FileChange[] | undefined,
  path: string,
): FileAddition | undefined {
  const change = files?.find((file) => file.path === path);
  if (change?.type === 'deletion') {
    throw new Error(`Cannot reconcile deleted Vite+ manifest ${path}`);
  }
  return change;
}

async function readManifestSnapshot(
  config: PostUpdateConfig<NpmManagerData>,
  path: string,
  kind: ManifestKind,
): Promise<ManifestSnapshot | undefined> {
  const baselineContents = await getFile(
    path,
    config.reuseExistingBranch ? config.branchName : config.baseBranch,
  );
  const artifact = findAddition(config.updatedArtifacts, path);
  const packageFile = findAddition(config.updatedPackageFiles, path);
  const contents =
    artifact?.contents ?? packageFile?.contents ?? baselineContents;
  if (isNullOrUndefined(contents)) {
    return undefined;
  }

  const normalizedContents = contents.toString();
  if (Buffer.byteLength(normalizedContents) > MAX_MANIFEST_BYTES) {
    throw new Error(`Vite+ manifest exceeds the protocol limit: ${path}`);
  }
  return { path, kind, contents: normalizedContents, baselineContents };
}

async function collectManifestSnapshots(
  config: PostUpdateConfig<NpmManagerData>,
  workspace: WorkspacePackageFiles,
): Promise<ManifestSnapshot[]> {
  const paths = new Map<string, ManifestKind>();
  for (const packageFile of workspace.packageFiles) {
    if (packageFile.packageFile?.endsWith('package.json')) {
      paths.set(packageFile.packageFile, 'packageJson');
    } else if (packageFile.packageFile?.endsWith('.yarnrc.yml')) {
      paths.set(packageFile.packageFile, 'yarnRc');
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
        .map(([path, kind]) => readManifestSnapshot(config, path, kind)),
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
  const parsed =
    kind === 'packageJson' ? parseJsonc(contents) : parseSingleYaml(contents);
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
    if (
      path.length === 3 &&
      ((path[0] === 'pnpm' && path[1] === 'overrides') ||
        path[0] === 'catalogs' ||
        (path[0] === 'workspaces' && path[1] === 'catalog'))
    ) {
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

function dependencyVersionChange(
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
  const change = dependencyVersionChange(kind, path, before, after);
  if (!change) {
    throw new Error(
      `Vite+ attempted an unsupported manifest change at ${path.join('.')}`,
    );
  }
  const { packageName, version } = change;

  if (
    (packageName === VITE_PLUS_PACKAGE_NAME ||
      packageName === VITE_PLUS_CORE_PACKAGE_NAME) &&
    version !== vitePlusVersion
  ) {
    throw new Error(
      `Vite+ returned an unexpected Vite+ version for ${packageName}`,
    );
  }

  if (isVitestPackage(packageName)) {
    state.vitestVersion ??= version;
    if (state.vitestVersion !== version) {
      throw new Error('Vite+ returned inconsistent Vitest ecosystem versions');
    }
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
      throw new Error(
        `Vite+ attempted to add or remove manifest keys at ${path.join('.')}`,
      );
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

function parseAndValidatePlan(
  stdout: string,
  snapshots: ManifestSnapshot[],
  vitePlusVersion: string,
): { plan: SyncVersionsPlan; vitestVersion?: string } {
  let rawPlan: unknown;
  try {
    rawPlan = JSON.parse(stdout);
  } catch {
    throw new Error('Vite+ returned invalid sync plan JSON');
  }
  const result = SyncVersionsPlan.safeParse(rawPlan);
  if (!result.success) {
    throw new Error(
      `Vite+ returned an invalid sync plan: ${result.error.message}`,
    );
  }
  const plan = result.data;
  if (plan.tool.version !== vitePlusVersion) {
    throw new Error(
      `Vite+ sync plan version ${plan.tool.version} does not match ${vitePlusVersion}`,
    );
  }

  const snapshotsByPath = new Map(
    snapshots.map((snapshot) => [snapshot.path, snapshot]),
  );
  const replacementPaths = new Set<string>();
  const state: ValidationState = { changedValues: 0 };
  for (const replacement of plan.replacements) {
    if (replacementPaths.has(replacement.path)) {
      throw new Error(
        `Vite+ returned duplicate replacement ${replacement.path}`,
      );
    }
    replacementPaths.add(replacement.path);

    const snapshot = snapshotsByPath.get(replacement.path);
    if (!snapshot || snapshot.kind !== replacement.kind) {
      throw new Error(`Vite+ returned an unknown manifest ${replacement.path}`);
    }
    if (replacement.before !== snapshot.contents) {
      throw new Error(`Vite+ sync plan is stale for ${replacement.path}`);
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

  return { plan, vitestVersion: state.vitestVersion };
}

function removeAddition(files: FileChange[] | undefined, path: string): void {
  if (!files) {
    return;
  }
  const index = files.findIndex((file) => file.path === path);
  if (index >= 0) {
    files.splice(index, 1);
  }
}

function applyReplacement(
  config: PostUpdateConfig<NpmManagerData>,
  snapshot: ManifestSnapshot,
  after: string,
): void {
  const artifact = findAddition(config.updatedArtifacts, snapshot.path);
  const packageFile = findAddition(config.updatedPackageFiles, snapshot.path);
  if (after === snapshot.baselineContents) {
    removeAddition(config.updatedArtifacts, snapshot.path);
    removeAddition(config.updatedPackageFiles, snapshot.path);
    return;
  }
  if (artifact) {
    artifact.contents = after;
  } else if (packageFile) {
    packageFile.contents = after;
  } else {
    config.updatedPackageFiles ??= [];
    config.updatedPackageFiles.push({
      type: 'addition',
      path: snapshot.path,
      contents: after,
    });
  }
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
  config: PostUpdateConfig<NpmManagerData>,
  upgrades: Upgrade<NpmManagerData>[],
  vitePlusVersion: string,
  vitestVersion: string | undefined,
): void {
  const noOpUpgrades = new Set<Upgrade<NpmManagerData>>();
  for (const upgrade of upgrades as MutableUpgrade[]) {
    const packageName = upgrade.packageName ?? upgrade.depName;
    const version =
      packageName === VITE_PLUS_PACKAGE_NAME ||
      packageName === VITE_PLUS_CORE_PACKAGE_NAME
        ? vitePlusVersion
        : vitestVersion;
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
    if (upgrade.currentVersion === version) {
      noOpUpgrades.add(upgrade);
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
      upgrade.isBreaking = upgrade.updateType === 'major';
    }
  }
  if (noOpUpgrades.size > 0) {
    config.upgrades = config.upgrades.filter(
      (upgrade) => !noOpUpgrades.has(upgrade),
    );
  }
}

async function runPlanner(
  workspace: WorkspacePackageFiles,
  snapshots: ManifestSnapshot[],
  vitePlusVersion: string,
): Promise<{ plan: SyncVersionsPlan; vitestVersion?: string } | undefined> {
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
        toolConstraints: plannerToolConstraints(vitePlusVersion),
      },
    ).catch((error: unknown) => {
      if (isUnsupportedPlannerError(error, vitePlusVersion)) {
        logger.debug(
          { workspace: workspace.root, vitePlusVersion },
          'Skipping Vite+ reconciliation for a release without planner support',
        );
        return null;
      }
      throw error;
    });
    if (!result) {
      return undefined;
    }
    return parseAndValidatePlan(result.stdout, snapshots, vitePlusVersion);
  });
}

export async function reconcileVitePlusVersions(
  config: PostUpdateConfig<NpmManagerData>,
  packageFiles: AdditionalPackageFiles,
): Promise<ArtifactNotice[]> {
  const notices: ArtifactNotice[] = [];
  if (!config.postUpdateOptions?.includes('vitePlusSyncVersions')) {
    return notices;
  }

  const workspaces = groupPackageFiles(packageFiles);
  const packageRootByPath = new Map<string, string>();
  for (const workspace of workspaces) {
    for (const packageFile of workspace.packageFiles) {
      if (packageFile.packageFile) {
        packageRootByPath.set(packageFile.packageFile, workspace.root);
      }
    }
  }

  for (const workspace of workspaces) {
    const upgrades = getRelevantUpgrades(config, workspace, packageRootByPath);
    if (upgrades.length === 0) {
      continue;
    }
    if (
      !workspace.packageFiles.some((packageFile) =>
        packageFile.deps?.some(
          (dependency) => dependency.depName === VITE_PLUS_PACKAGE_NAME,
        ),
      )
    ) {
      continue;
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
      notices.push(plannerNotice(workspace, message));
      continue;
    }
    const vitePlusVersion = resolveVitePlusVersion(workspace, upgrades);
    const snapshots = await collectManifestSnapshots(config, workspace);
    if (snapshots.length === 0) {
      throw new Error(
        `No Vite+ manifests found in workspace ${workspace.root}`,
      );
    }
    const result = await runPlanner(workspace, snapshots, vitePlusVersion);
    if (!result) {
      notices.push(
        plannerNotice(
          workspace,
          `Vite+ ${vitePlusVersion} predates version reconciliation support; declared versions were left unchanged.`,
        ),
      );
      continue;
    }
    const { plan, vitestVersion } = result;
    const snapshotsByPath = new Map(
      snapshots.map((snapshot) => [snapshot.path, snapshot]),
    );
    for (const replacement of plan.replacements) {
      applyReplacement(
        config,
        snapshotsByPath.get(replacement.path)!,
        replacement.after,
      );
    }
    updateUpgradeMetadata(config, upgrades, vitePlusVersion, vitestVersion);
    logger.debug(
      {
        workspace: workspace.root,
        vitePlusVersion,
        replacementCount: plan.replacements.length,
      },
      'Reconciled Vite+ managed dependency versions',
    );
  }
  return notices;
}
