import { regEx } from '../../../util/regex.ts';
import type { ParsedWrapper, WrapperFile, WrapperForm } from './types.ts';

export const defaultDownloadRoot =
  'https://packages.jetbrains.team/maven/p/amper/amper';

export const wrapperFiles: WrapperFile[] = [
  {
    name: 'kotlin',
    artifactSuffix: '-wrapper',
    isExecutable: true,
    form: 'shell',
  },
  {
    name: 'kotlin.bat',
    artifactSuffix: '-wrapper.bat',
    isExecutable: false,
    form: 'batch',
  },
];

interface FormPatterns {
  version: RegExp;
  sha256: RegExp;
  downloadRoot: RegExp;
}

const shellPatterns: FormPatterns = {
  version: regEx(
    /^(?<versionLine>kotlin_cli_version=(?<version>[A-Za-z0-9._+-]+))[ \t\r]*$/m,
  ),
  sha256: regEx(/^kotlin_cli_sha256=(?<sha256>[0-9a-fA-F]{64})[ \t\r]*$/m),
  downloadRoot: regEx(
    /^(?<prefix>KOTLIN_CLI_DOWNLOAD_ROOT="\$\{KOTLIN_CLI_DOWNLOAD_ROOT:-)(?<root>https?:\/\/[^\s"}]+)/m,
  ),
};

const batchPatterns: FormPatterns = {
  version: regEx(
    /^(?<versionLine>set[ \t]+kotlin_cli_version=(?<version>[A-Za-z0-9._+-]+))[ \t\r]*$/m,
  ),
  sha256: regEx(
    /^set[ \t]+kotlin_cli_sha256=(?<sha256>[0-9a-fA-F]{64})[ \t\r]*$/m,
  ),
  downloadRoot: regEx(
    /^(?<prefix>if[ \t]+not[ \t]+defined[ \t]+KOTLIN_CLI_DOWNLOAD_ROOT[ \t]+set[ \t]+"?KOTLIN_CLI_DOWNLOAD_ROOT=)(?<root>https?:\/\/[^\s"]+)/m,
  ),
};

function patternsFor(form: WrapperForm): FormPatterns {
  return form === 'shell' ? shellPatterns : batchPatterns;
}

function parseForm(content: string, form: WrapperForm): ParsedWrapper | null {
  const patterns = patternsFor(form);

  const versionGroups = patterns.version.exec(content)?.groups;
  if (!versionGroups) {
    return null;
  }

  const shaGroups = patterns.sha256.exec(content)?.groups;
  const root = patterns.downloadRoot.exec(content)?.groups?.root;

  return {
    version: versionGroups.version,
    versionLine: versionGroups.versionLine,
    sha256: shaGroups ? shaGroups.sha256 : null,
    downloadRoot: root ?? defaultDownloadRoot,
    form,
  };
}

export function parseWrapper(content: string): ParsedWrapper | null {
  return parseForm(content, 'shell') ?? parseForm(content, 'batch');
}

export function withDownloadRoot(
  content: string,
  form: WrapperForm,
  downloadRoot: string,
): string | null {
  const regex = patternsFor(form).downloadRoot;
  if (!regex.test(content)) {
    return null;
  }

  return content.replace(
    regex,
    (...args) =>
      `${(args.at(-1) as Record<string, string>).prefix}${downloadRoot}`,
  );
}

export function disagreement(
  a: ParsedWrapper,
  b: ParsedWrapper,
): string | null {
  if (a.version !== b.version) {
    return `versions ${a.version} and ${b.version}`;
  }
  if (a.sha256?.toLowerCase() !== b.sha256?.toLowerCase()) {
    return `checksums ${a.sha256 ?? 'none'} and ${b.sha256 ?? 'none'}`;
  }
  if (a.downloadRoot !== b.downloadRoot) {
    return `download roots ${a.downloadRoot} and ${b.downloadRoot}`;
  }
  return null;
}
