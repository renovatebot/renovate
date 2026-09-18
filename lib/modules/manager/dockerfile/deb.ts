import { logger } from '../../../logger/index.ts';
import { regEx } from '../../../util/regex.ts';
import { DebDatasource } from '../../datasource/deb/index.ts';
import { api as debVersioning } from '../../versioning/deb/index.ts';
import { RollingReleasesData } from '../../versioning/debian/common.ts';
import { DistroInfo } from '../../versioning/distro.ts';
import type { PackageDependency } from '../types.ts';
import { parseRunCommands } from './run-command.ts';

/**
 * `apt` options which consume the following argument, so that the argument is
 * not mistaken for a package name.
 *
 * Options given as `--opt=value` are a single token, so they need no entry here.
 */
const optionsWithValue = new Set([
  '-o',
  '--option',
  '-c',
  '--config-file',
  '-t',
  '--target-release',
  '--default-release',
  '-a',
  '--host-architecture',
  '--build-profiles',
]);

/**
 * An `apt` package specification, e.g. `curl`, `curl=8.5.0-2ubuntu10.6`,
 * `curl:amd64=8.5.0-2ubuntu10.6` or `curl/bookworm-backports`.
 *
 * The `:arch` qualifier selects the architecture to install for, and the
 * `/release` suffix picks the suite to install from - both are part of the
 * spec rather than of the package name.
 */
const debSpecRegex = regEx(
  /^(?<name>[a-z0-9][a-z0-9+.-]*)(?::(?<arch>[a-z0-9][a-z0-9-]*))?(?:=(?<version>.+)|\/(?<release>[a-z0-9][\w.-]*))?$/,
);

function parseSpec(spec: string): PackageDependency | null {
  const groups = debSpecRegex.exec(spec)?.groups;
  if (!groups) {
    logger.trace({ spec }, 'Skipping unparseable apt package spec');
    return null;
  }

  const { name, version } = groups;
  const dep: PackageDependency = {
    datasource: DebDatasource.id,
    depName: name,
  };

  if (!version) {
    // a bare name, or one only pinned to a suite, leaves Renovate nothing to
    // update
    dep.skipReason = 'unspecified-version';
    return dep;
  }

  if (version.includes('$')) {
    dep.skipReason = 'contains-variable';
    return dep;
  }

  // `apt` also accepts a wildcard such as `curl=8.5.*`, which is not a version
  // we can compare against the releases we find
  if (!debVersioning.isSingleVersion(version)) {
    dep.skipReason = 'unsupported-version';
    return dep;
  }

  dep.currentValue = version;
  dep.replaceString = spec;
  // Only the version is templated, so an `:arch` in the spec is preserved
  dep.autoReplaceStringTemplate = `${spec.slice(0, -version.length)}{{{newValue}}}`;
  return dep;
}

/** Package specs which are not registry lookups, and so are silently ignored */
function isIgnoredSpec(spec: string): boolean {
  return (
    // local or remote `.deb` files, e.g. `apt install ./curl_8.5.0-2_amd64.deb`
    spec.endsWith('.deb') ||
    spec.startsWith('.') ||
    spec.startsWith('/') ||
    // the `-` removes a package and the `+` installs one, e.g.
    // `apt install curl vim-`
    spec.endsWith('-') ||
    spec.endsWith('+')
  );
}

function extractAptInstallArgs(tokens: string[]): PackageDependency[] {
  const deps: PackageDependency[] = [];
  let subCommandFound = false;

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];

    if (token.startsWith('-')) {
      if (optionsWithValue.has(token)) {
        i += 1;
      }
      continue;
    }

    if (!subCommandFound) {
      // `apt` accepts global options before the sub-command, so the first
      // non-option token is the sub-command
      if (token !== 'install') {
        return [];
      }
      subCommandFound = true;
      continue;
    }

    if (isIgnoredSpec(token)) {
      logger.trace({ spec: token }, 'Skipping apt package spec');
      continue;
    }

    const dep = parseSpec(token);
    if (dep) {
      deps.push(dep);
    }
  }

  return deps;
}

/**
 * Extracts Debian packages pinned by `apt install` or `apt-get install` in a
 * `RUN` instruction, e.g.
 *
 * ```dockerfile
 * RUN apt-get update && apt-get install -y --no-install-recommends \
 *       curl=8.5.0-2ubuntu10.6 \
 *       git=1:2.43.0-1ubuntu7.3
 * ```
 *
 * @param instruction the full `RUN` instruction, including any line continuations
 * @param escapeChar the Dockerfile escape character, already regex-escaped
 */
export function extractDebDeps(
  instruction: string,
  escapeChar: string,
): PackageDependency[] {
  return parseRunCommands(instruction, escapeChar, ['apt', 'apt-get']).flatMap(
    extractAptInstallArgs,
  );
}

/**
 * The architecture the detected repositories are read for.
 *
 * A Dockerfile does not say which architectures it is built for, so the most
 * common one is assumed - override it with a `packageRules` entry when you
 * build for another.
 */
const binaryArch = 'amd64';

const debianRegistry = 'https://deb.debian.org/debian';
const debianComponents = 'main,contrib,non-free';

const ubuntuRegistry = 'https://archive.ubuntu.com/ubuntu';
const ubuntuSecurityRegistry = 'https://security.ubuntu.com/ubuntu';
const ubuntuComponents = 'main,restricted,universe,multiverse';

/** The Debian image itself, e.g. `debian` or `public.ecr.aws/docker/library/debian` */
const debianImageRegex = regEx(/^(?:.+\/)?debian$/);

/** The Ubuntu image itself, e.g. `ubuntu` or `public.ecr.aws/docker/library/ubuntu` */
const ubuntuImageRegex = regEx(/^(?:.+\/)?ubuntu$/);

/** A point release, e.g. the `12.11` Debian is also tagged with */
const pointReleaseRegex = regEx(/^(?<major>\d+)\.\d+$/);

/** Tag suffixes which describe the image's contents rather than its release */
const variantSuffixRegex = regEx(/-slim$/);
const buildDateSuffixRegex = regEx(/-\d{8}(?:\.\d{1,2})?$/);

const debianDistroInfo = new DistroInfo('data/debian-distro-info.json');
const debianRollingReleases = new RollingReleasesData(debianDistroInfo);
const ubuntuDistroInfo = new DistroInfo('data/ubuntu-distro-info.json');

/**
 * Strips the parts of a tag which do not name a release, e.g. the
 * `bookworm-20240110-slim` of `debian:bookworm-20240110-slim`.
 */
function stripTagSuffixes(currentValue: string): string {
  return currentValue
    .replace(variantSuffixRegex, '')
    .replace(buildDateSuffixRegex, '');
}

/** Returns the codename of a release named by either codename or version */
function resolveCodename(
  distroInfo: DistroInfo,
  release: string,
): string | null {
  if (distroInfo.isCodename(release)) {
    return release;
  }

  if (distroInfo.exists(release)) {
    return distroInfo.getCodenameByVersion(release);
  }

  // Debian is also tagged with its point release, which names no suite of its own
  const major = pointReleaseRegex.exec(release)?.groups?.major;
  if (major && distroInfo.exists(major)) {
    return distroInfo.getCodenameByVersion(major);
  }

  return null;
}

/**
 * Returns the codename which the `debian` image's tag names.
 *
 * Debian's rolling aliases resolve to the release they currently point at, so
 * that the suites Renovate reads stay the ones the image was built from.
 */
function codenameFromDebianTag(
  currentValue: string | null | undefined,
): string | null {
  // an untagged image, and `debian:latest`, are the current stable release
  const tag = currentValue ? stripTagSuffixes(currentValue) : 'latest';
  const release = tag === 'latest' ? 'stable' : tag;
  return resolveCodename(
    debianDistroInfo,
    debianRollingReleases.getVersionByLts(release),
  );
}

/**
 * Returns the codename which the `ubuntu` image's tag names.
 *
 * Unlike Debian, Ubuntu's floating tags (`latest`, `rolling`, `devel`) name no
 * suite which Renovate could read, so they are left undetected.
 */
function codenameFromUbuntuTag(
  currentValue: string | null | undefined,
): string | null {
  if (!currentValue) {
    return null;
  }

  return resolveCodename(ubuntuDistroInfo, stripTagSuffixes(currentValue));
}

/**
 * The suites a Debian release installs from.
 *
 * Only the release's own suite is read: Debian folds `-updates` and `-security`
 * into it at each point release, and those two suites publish their index as
 * `Packages.xz` only, which the `deb` datasource cannot read.
 */
function debianRegistryUrls(codename: string): string[] {
  return [
    `${debianRegistry}?suite=${codename}&components=${debianComponents}&binaryArch=${binaryArch}`,
  ];
}

/**
 * The suites an Ubuntu release installs from.
 *
 * Ubuntu never republishes its release suite, so a pinned version usually comes
 * from `-updates` or `-security` instead and all three are read.
 */
function ubuntuRegistryUrls(codename: string): string[] {
  const params = `components=${ubuntuComponents}&binaryArch=${binaryArch}`;
  return [
    `${ubuntuRegistry}?suite=${codename}&${params}`,
    `${ubuntuRegistry}?suite=${codename}-updates&${params}`,
    `${ubuntuSecurityRegistry}?suite=${codename}-security&${params}`,
  ];
}

/**
 * Returns the repositories which another image's tag names, e.g. the Debian
 * `bookworm` repositories of `node:22-bookworm-slim`.
 *
 * Images built on Debian or Ubuntu name the release last, after the tag's own
 * version and variant, so only the last part of the tag is read as a codename.
 */
function registryUrlsFromTagSuffix(
  currentValue: string | null | undefined,
): string[] | undefined {
  if (!currentValue) {
    return undefined;
  }

  const suffix = stripTagSuffixes(currentValue).split('-').pop()!;

  if (debianDistroInfo.isCodename(suffix)) {
    return debianRegistryUrls(suffix);
  }

  if (ubuntuDistroInfo.isCodename(suffix)) {
    return ubuntuRegistryUrls(suffix);
  }

  return undefined;
}

/**
 * Works out which Debian repositories a base image installs from, so that
 * `apt install` is looked up against the packages the image actually has.
 *
 * Only images which name their release are recognised - an image such as
 * `node:22` is built on Debian, but its name does not say which release, so no
 * `registryUrl` is detected and the `deb` datasource falls back to its default.
 * Set the `registryUrls` yourself with a `packageRules` entry for those, which
 * also takes priority over what is detected here.
 *
 * @param image the `FROM` image of the stage the packages are installed in
 */
export function detectDebRegistryUrls(
  image: PackageDependency,
): string[] | undefined {
  const { depName, currentValue } = image;
  if (!depName) {
    return undefined;
  }

  if (debianImageRegex.test(depName)) {
    const codename = codenameFromDebianTag(currentValue);
    return codename ? debianRegistryUrls(codename) : undefined;
  }

  if (ubuntuImageRegex.test(depName)) {
    const codename = codenameFromUbuntuTag(currentValue);
    return codename ? ubuntuRegistryUrls(codename) : undefined;
  }

  return registryUrlsFromTagSuffix(currentValue);
}
