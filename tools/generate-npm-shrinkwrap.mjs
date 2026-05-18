/**
 * Generate npm-shrinkwrap.json pinned to the exact versions in pnpm-lock.yaml.
 *
 * pnpm-lock.yaml is the source of truth for what versions were tested.
 * We extract every resolved production package version from the lockfile and
 * pass them as exact-version overrides when generating the npm lockfile, so
 * the shrinkwrap reflects the same tree without floating any ranges.
 */

import { execaSync } from 'execa';
import fs from 'fs-extra';
import os from 'os';
import upath from 'upath';
import { parse as parseYaml } from 'yaml';

const root = process.cwd();
const pkg = await fs.readJson(upath.join(root, 'package.json'));
const pnpmLock = parseYaml(
  await fs.readFile(upath.join(root, 'pnpm-lock.yaml'), 'utf8'),
);

// Extract every package@version that pnpm resolved (from the packages section).
// These are the exact versions pnpm downloaded and tested.
/** @type {Record<string, string>} */
const pnpmVersions = {};
for (const key of Object.keys(pnpmLock.packages ?? {})) {
  // key format: "name@version" or "@scope/name@version"
  const atIdx = key.lastIndexOf('@');
  if (atIdx <= 0) {
    continue;
  }
  const name = key.slice(0, atIdx);
  const version = key.slice(atIdx + 1);
  pnpmVersions[name] ??= version;
}

// Build npm overrides from pnpm's resolved versions so npm install --package-lock-only
// produces a tree that matches the pnpm lockfile instead of re-resolving semver ranges.
// npm rejects overrides that conflict with direct deps, so skip those — they're already exact.
const directDeps = new Set([
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.optionalDependencies ?? {}),
]);
/** @type {Record<string, string>} */
const npmOverrides = {};
for (const [name, version] of Object.entries(pnpmVersions)) {
  if (!directDeps.has(name)) {
    npmOverrides[name] = version;
  }
}

const publishPkg = {
  name: pkg.name,
  version: pkg.version ?? '0.0.0',
  dependencies: pkg.dependencies,
  optionalDependencies: pkg.optionalDependencies,
  overrides: npmOverrides,
};

const tmpDir = await fs.mkdtemp(
  upath.join(os.tmpdir(), 'renovate-shrinkwrap-'),
);

try {
  await fs.writeJson(upath.join(tmpDir, 'package.json'), publishPkg, {
    spaces: 2,
  });

  execaSync(
    'npm',
    ['install', '--package-lock-only', '--omit=dev', '--ignore-scripts'],
    {
      cwd: tmpDir,
      stdio: 'inherit',
    },
  );

  const lock = await fs.readJson(upath.join(tmpDir, 'package-lock.json'));

  if (lock.lockfileVersion < 2) {
    throw new Error(
      `Expected lockfileVersion >= 2, got ${lock.lockfileVersion}`,
    );
  }

  // Strip the overrides block from the shrinkwrap root — consumers don't need them,
  // all versions are already exact in the resolved packages entries.
  if (lock.packages?.['']) {
    delete lock.packages[''].overrides;
  }

  const outPath = upath.join(root, 'npm-shrinkwrap.json');
  await fs.writeJson(outPath, lock, { spaces: 2 });
  await fs.writeFile(outPath, `${await fs.readFile(outPath, 'utf8')}\n`);

  const count = Object.keys(lock.packages ?? {}).length;
  console.log(
    `Wrote ${upath.relative(root, outPath)} (${count} packages pinned to pnpm-lock.yaml versions)`,
  );
} finally {
  await fs.remove(tmpDir);
}
