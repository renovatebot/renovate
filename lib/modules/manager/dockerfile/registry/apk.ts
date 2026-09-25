import { regEx } from '../../../../util/regex.ts';
import type { PackageDependency } from '../../types.ts';
import { arch } from './common.ts';

/** The Alpine repository, which serves one index per branch and component */
const alpineRegistry = 'https://dl-cdn.alpinelinux.org/alpine';

/**
 * The Alpine components to look in.
 *
 * `testing` is left out because it only exists on `edge`, and a package which
 * is only in `testing` cannot be installed from a released branch anyway.
 */
const alpineComponents = 'main,community';

/** The Wolfi repository, which Chainguard's images install from */
const wolfiRegistry = 'https://packages.wolfi.dev/os';

/** The Alpine image itself, e.g. `alpine` or `public.ecr.aws/docker/library/alpine` */
const alpineImageRegex = regEx(/^(?:.+\/)?alpine$/);

/** An Alpine release tag, e.g. `3.21` or `3.21.4` */
const alpineTagRegex = regEx(/^(?<branch>\d+\.\d+)(?:\.\d+)?$/);

/**
 * The Alpine release named by another image's tag, e.g. the `3.21` of
 * `node:22-alpine3.21`.
 *
 * A bare `-alpine` suffix names no release, so it is deliberately not matched.
 */
const alpineTagSuffixRegex = regEx(/\balpine(?<branch>\d+\.\d+)\b/);

/** A Wolfi-based image, e.g. `cgr.dev/chainguard/wolfi-base` */
const wolfiImageRegex = regEx(
  /^(?:cgr\.dev\/chainguard\/.+|(?:.+\/)?wolfi-base)$/,
);

/** Returns the Alpine branch which the `alpine` image's tag names */
function branchFromAlpineTag(
  currentValue: string | null | undefined,
): string | null {
  // an untagged image is the same as `alpine:latest`
  if (!currentValue || currentValue === 'latest') {
    return 'latest-stable';
  }

  if (currentValue === 'edge') {
    return 'edge';
  }

  const branch = alpineTagRegex.exec(currentValue)?.groups?.branch;
  return branch ? `v${branch}` : null;
}

/** Returns the Alpine branch which another image's tag names, if any */
function branchFromAlpineTagSuffix(
  currentValue: string | null | undefined,
): string | null {
  if (!currentValue) {
    return null;
  }

  const branch = alpineTagSuffixRegex.exec(currentValue)?.groups?.branch;
  return branch ? `v${branch}` : null;
}

/**
 * Works out which APK repository a base image installs from, so that `apk add`
 * is looked up against the packages the image actually has.
 *
 * Only images which name their distribution are recognised - an image such as
 * `vault:1.13.3` is built on Alpine, but its name does not say which release,
 * so no `registryUrl` is detected and the `apk` datasource falls back to its
 * default. Set the `registryUrls` yourself with a `packageRules` entry for
 * those, which also takes priority over what is detected here.
 *
 * @param image the `FROM` image of the stage the packages are installed in
 */
export function detectApkRegistryUrls(
  image: PackageDependency,
): string[] | undefined {
  const { depName, currentValue } = image;
  if (!depName) {
    return undefined;
  }

  if (wolfiImageRegex.test(depName)) {
    return [`${wolfiRegistry}?arch=${arch}`];
  }

  const branch = alpineImageRegex.test(depName)
    ? branchFromAlpineTag(currentValue)
    : branchFromAlpineTagSuffix(currentValue);
  if (!branch) {
    return undefined;
  }

  return [
    `${alpineRegistry}?branch=${branch}&components=${alpineComponents}&arch=${arch}`,
  ];
}
