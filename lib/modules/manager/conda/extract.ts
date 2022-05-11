import { load } from 'js-yaml';
import { logger } from '../../../logger';
import { regEx } from '../../../util/regex';
import type { PackageDependency, PackageFile } from '../types';
import type { CondaEnvironment } from './types';

// See https://github.com/conda/conda/blob/0ce67ff01354667d6cf8c956839a401f42e41bde/conda/models/match_spec.py#L91
const matchSpecRegex = regEx(
  /^((?<channel>[^/]+)(\/(?<subdir>.+))?:(?<namespace>.*):)?(?<name>[^[=]+)(?<exact>==?)(?<epoch>\d+!)?(?<version>(\d+\.){1,2}\d[^[=]*)(?<build>=[^[]+)?(\[(?<keyvalue>.+)\])?/
);

// This currently only supports strict semver versions. conda also supports
// versions with 4 numeric components (e.g. 7.10.3.1)
// As we do only support exact matching with strict semver as of now, this
// regex is sufficient for now.
const releaseVersionRegex = regEx(/^(?<version>(\d+\.){1,2}\d)$/);

export function extractPackageFile(content: string): PackageFile | null {
  let parsedContent: CondaEnvironment;
  try {
    parsedContent = load(content, { json: true }) as any;
  } catch (err) {
    logger.debug({ err }, 'Failed to parse conda environment.yml');
    return null;
  }

  // Conda has the concept of 'default' channels. They are defined in
  // https://github.com/conda/conda/blob/c6ead1bfaf14f6d5274cc05272212b95d55bac27/conda/base/constants.py#L89-L104.
  //
  // If they are not explicitly excluded or the keyword 'defaults' is explicitly
  // specified as a channel, the default channels are used.
  let channels: string[] = [];
  // When channels contains 'nodefaults', the default channels are excluded
  if (parsedContent.channels?.includes('nodefaults')) {
    channels = parsedContent.channels.filter((obj) => {
      return obj !== 'nodefaults';
    });

    // When the channels only include nodefaults, there are
    // no channels that can be used. We therefore create
    // a faulty package and return it
    // This is only done to prevent unnecessary HTTP requests
    if (channels.length === 0) {
      return {
        deps: [
          {
            depName: 'nodefaults',
            skipReason: 'invalid-config',
          },
        ],
      };
    }

    // We include default channels for Unix, but not msys2 which is default on Windows.
    // If users use Windows and want all updates with defaults, they need to explicitly
    // include msys2 as channel
  } else {
    // Remove 'defaults' if any channels are specified
    if (parsedContent.channels) {
      channels = parsedContent.channels.filter((obj) => {
        return obj !== 'defaults';
      });
    }

    // Always add default channels
    channels.push('main', 'r');
  }

  const deps: PackageDependency[] = [];
  parsedContent.dependencies?.forEach((parsedDep) => {
    // If the parsedDep is the 'pip' key, continue
    if (typeof parsedDep === 'object') {
      logger.debug(
        'Found object in package file, assuming pip key, which is unsupported'
      );
      return;
    }

    // Parse the dependency string
    const match = matchSpecRegex.exec(parsedDep);
    if (match?.groups) {
      const dep = extractDependency(match.groups, channels);
      if (dep) {
        deps.push(...dep);
      }
    } else {
      // If we can't parse the dependency correctly, we set the whole line as
      // depName so that users can more easily debug what part of the dependency
      // is not supported yet in the manager
      deps.push({
        skipReason: 'unsupported',
        depName: parsedDep,
      });
    }
  });

  return deps.length ? { datasource: 'conda', deps } : null;
}

export function extractDependency(
  groups: Record<string, string>,
  channels: Array<string>
): PackageDependency[] | null {
  const dep: PackageDependency = {
    // We set depName to the captured name so that on invalid or
    // unsupported configurations it is shown as invalid/unsupported once
    depName: groups.name,
    currentValue: groups.version,
  };

  // To ensure that we only push correct updates, any specification containing
  // one of the following is unsupported as of now:
  //   * key-value pairs
  //   * an epoch
  //   * an exact build version (those are specified as name==version=build_version)
  if (groups.keyvalue || groups.epoch || groups.build) {
    dep.skipReason = 'unsupported';
    return [dep];
  }

  // Check if the version is strict semver
  const versionMatch = releaseVersionRegex.exec(groups.version);

  // If exact matching is used (name==version), we know the exact
  // version used and set it explicitly.
  if (versionMatch?.groups?.version && groups.exact === '==') {
    dep.currentVersion = groups.version;
    dep.versioning = 'semver';
    // We do not yet support fuzzy matching or version pinning,
    // therefore everything that has not an exact version is skipped
  } else {
    dep.skipReason = 'unsupported';
    return [dep];
  }

  // If a channel is set explicitly for the dependency, set
  // the package name immediately
  if (groups.channel) {
    let subdir = '';

    // Append a / if there is a subdir
    if (groups.subdir) {
      subdir = groups.subdir === '' ? '' : groups.subdir + '/';
    }

    dep.packageName = groups.channel + '/' + subdir + groups.name;
    dep.depName = dep.packageName;
  }

  // For all valid dependencies without a channel specified, add all channels
  // from the channels list
  if (!dep.skipReason && !dep.packageName) {
    const channelDeps: PackageDependency[] = [];
    for (const channel of channels) {
      // This is a shallow copy! As we can keep all references that this shallow copy holds,
      // this is okay. If you read this comment and have a better idea, please let us know!
      const cloneDep = Object.assign({}, dep);

      /* eslint-disable-next-line @typescript-eslint/restrict-template-expressions */
      cloneDep.depName = `${channel}/${cloneDep.depName}`;
      cloneDep.packageName = cloneDep.depName;

      channelDeps.push(cloneDep);
    }

    return channelDeps;
  }

  return [dep];
}
