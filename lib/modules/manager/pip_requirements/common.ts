import { GlobalConfig } from '../../../config/global';
import { newlineRegex, regEx } from '../../../util/regex';
import type { PackageFileContent } from '../types';
import type { PipRequirementsManagerData } from './types';

function cleanRegistryUrls(registryUrls: string[]): string[] {
  return registryUrls.map((url) => {
    // handle the optional quotes in eg. `--extra-index-url "https://foo.bar"`
    const cleaned = url.replace(regEx(/^"/), '').replace(regEx(/"$/), '');
    if (!GlobalConfig.get('exposeAllEnv')) {
      return cleaned;
    }
    // interpolate any environment variables
    return cleaned.replace(
      regEx(/(\$[A-Za-z\d_]+)|(\${[A-Za-z\d_]+})/g),
      (match) => {
        const envvar = match
          .substring(1)
          .replace(regEx(/^{/), '')
          .replace(regEx(/}$/), '');
        const sub = process.env[envvar];
        return sub ?? match;
      },
    );
  });
}

export function extractPackageFileFlags(
  content: string,
): PackageFileContent<PipRequirementsManagerData> {
  let registryUrls: string[] = [];
  const additionalRegistryUrls: string[] = [];
  const additionalRequirementsFiles: string[] = [];
  const additionalConstraintsFiles: string[] = [];
  content.split(newlineRegex).forEach((line) => {
    if (line.startsWith('-i ') || line.startsWith('--index-url ')) {
      registryUrls = [line.split(' ')[1]];
    } else if (line.startsWith('--extra-index-url ')) {
      const extraUrl = line
        .substring('--extra-index-url '.length)
        .split(' ')[0];
      additionalRegistryUrls.push(extraUrl);
    } else if (line.startsWith('-r ')) {
      additionalRequirementsFiles.push(line.split(' ')[1]);
    } else if (line.startsWith('-c ')) {
      additionalConstraintsFiles.push(line.split(' ')[1]);
    }
  });

  const res: PackageFileContent<PipRequirementsManagerData> = { deps: [] };
  if (registryUrls.length > 0) {
    res.registryUrls = cleanRegistryUrls(registryUrls);
  }
  if (additionalRegistryUrls.length) {
    res.additionalRegistryUrls = cleanRegistryUrls(additionalRegistryUrls);
  }
  if (additionalRequirementsFiles.length) {
    res.managerData ??= {};
    res.managerData.requirementsFiles = additionalRequirementsFiles;
  }
  if (additionalConstraintsFiles.length) {
    res.managerData ??= {};
    res.managerData.constraintsFiles = additionalConstraintsFiles;
  }
  return res;
}
