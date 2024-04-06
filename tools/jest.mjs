import { spawnSync } from 'node:child_process';
import { argv, env, version } from 'node:process';
import semver from 'semver';

// needed for tests
env.GIT_ALLOW_PROTOCOL = 'file';
// reduce logging
env.LOG_LEVEL = 'fatal';

const args = ['--experimental-vm-modules'];

/*
 * openpgp encryption is broken because it needs PKCS#1 v1.5
 * - #27375
 * - https://nodejs.org/en/blog/vulnerability/february-2024-security-releases#nodejs-is-vulnerable-to-the-marvin-attack-timing-variant-of-the-bleichenbacher-attack-against-pkcs1-v15-padding-cve-2023-46809---medium
 *
 * Sadly there is no way to suppress this warning: `SECURITY WARNING: Reverting CVE-2023-46809: Marvin attack on PKCS#1 padding`
 */
if (semver.satisfies(version, '^18.19.1 || ^20.11.1 || >=21.6.2')) {
  args.push('--security-revert=CVE-2023-46809');
}

args.push('node_modules/jest/bin/jest.js', '--logHeapUsage');

// add other args after `node tools/jest.mjs`
args.push(...argv.slice(2));

const res = spawnSync('node', args, { stdio: 'inherit', env });

if (res.status !== null && res.status !== 0) {
  process.exit(res.status);
}
