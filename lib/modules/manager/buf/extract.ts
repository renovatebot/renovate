import { logger } from '../../../logger/index.ts';
import { coerceArray } from '../../../util/array.ts';
import { regEx } from '../../../util/regex.ts';
import { parseSingleYaml } from '../../../util/yaml.ts';
import { BufPluginDatasource } from '../../datasource/buf-plugin/index.ts';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types.ts';
import { BufGenYaml } from './schema.ts';

const remotePluginRegex = regEx(
  /^(?<host>[\w-]+(?:\.[\w-]+)+)\/(?<owner>[\w-]+)\/(?<name>[\w-]+)(?::(?<version>[\w.-]+))?$/,
);

function extractPlugin(ref: string): PackageDependency | null {
  const match = remotePluginRegex.exec(ref)?.groups;
  if (!match) {
    // Not a remote/curated plugin reference (e.g. a bare local plugin name)
    return null;
  }

  const { host, owner, name, version } = match;
  const dep: PackageDependency = {
    depName: `${owner}/${name}`,
    datasource: BufPluginDatasource.id,
    registryUrls: [`https://${host}`],
  };

  if (!version) {
    dep.skipReason = 'unspecified-version';
    return dep;
  }

  dep.currentValue = version;
  dep.replaceString = ref;
  dep.autoReplaceStringTemplate = ref.replace(
    version,
    '{{#if newValue}}{{newValue}}{{/if}}',
  );

  return dep;
}

export function extractPackageFile(
  content: string,
  packageFile: string,
  _config: ExtractConfig,
): PackageFileContent | null {
  const deps: PackageDependency[] = [];

  let plugins: ReturnType<typeof BufGenYaml.parse>['plugins'];
  try {
    const doc = parseSingleYaml(content);
    ({ plugins } = BufGenYaml.parse(doc));
  } catch (err) {
    logger.debug({ packageFile, err }, 'Failed to parse buf.gen.yaml');
    return null;
  }

  for (const plugin of coerceArray(plugins)) {
    const ref = plugin.remote ?? plugin.plugin;
    if (!ref) {
      continue;
    }

    const dep = extractPlugin(ref);
    if (dep) {
      deps.push(dep);
    }
  }

  return deps.length ? { deps } : null;
}
