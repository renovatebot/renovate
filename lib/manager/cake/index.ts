import moo from 'moo';
import { ProgrammingLanguage } from '../../constants';
import { id as datasource } from '../../datasource/nuget';
import { SkipReason } from '../../types';
import { regEx } from '../../util/regex';
import { PackageDependency, PackageFile } from '../types';

export const language = ProgrammingLanguage.NET;

export const defaultConfig = {
  fileMatch: ['\\.cake$'],
};

const lexer = moo.states({
  main: {
    lineComment: { match: /\/\/.*?$/ }, // TODO #12070
    multiLineComment: { match: /\/\*[^]*?\*\//, lineBreaks: true }, // TODO #12070
    dependency: {
      match: /^#(?:addin|tool|module|load|l)\s+(?:nuget|dotnet):.*$/, // TODO #12070
    },
    dependencyQuoted: {
      match: /^#(?:addin|tool|module|load|l)\s+"(?:nuget|dotnet):[^"]+"\s*$/, // TODO #12070
      value: (s: string) => s.trim().slice(1, -1),
    },
    unknown: moo.fallback,
  },
});

function parseDependencyLine(line: string): PackageDependency | null {
  try {
    let url = line.replace(regEx(/^[^:]*:/), '');
    const isEmptyHost = url.startsWith('?');
    url = isEmptyHost ? `http://localhost/${url}` : url;

    const { origin: registryUrl, protocol, searchParams } = new URL(url);

    const depName = searchParams.get('package');
    const currentValue = searchParams.get('version');

    const result: PackageDependency = { datasource, depName, currentValue };

    if (!isEmptyHost) {
      if (protocol.startsWith('http')) {
        result.registryUrls = [registryUrl];
      } else {
        result.skipReason = SkipReason.UnsupportedUrl;
      }
    }

    return result;
  } catch (err) {
    return null;
  }
}

export function extractPackageFile(content: string): PackageFile {
  const deps = [];
  lexer.reset(content);
  let token = lexer.next();
  while (token) {
    const { type, value } = token;
    if (type === 'dependency' || type === 'dependencyQuoted') {
      const dep = parseDependencyLine(value);
      if (dep) {
        deps.push(dep);
      }
    }
    token = lexer.next();
  }
  return { deps };
}
