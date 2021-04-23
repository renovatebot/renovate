import moo from 'moo';
import { LANGUAGE_DOT_NET } from '../../constants/languages';
import { id as datasource } from '../../datasource/nuget';
import { SkipReason } from '../../types';
import { PackageDependency, PackageFile } from '../types';

export const language = LANGUAGE_DOT_NET;

export const defaultConfig = {
  fileMatch: ['\\.cake$'],
};

const lexer = moo.states({
  main: {
    lineComment: { match: /\/\/.*?$/ },
    multiLineComment: { match: /\/\*[^]*?\*\//, lineBreaks: true },
    dependency: {
      match: /^#(?:addin|tool|module)\s+(?:nuget|dotnet):.*$/,
    },
    dependencyQuoted: {
      match: /^#(?:addin|tool|module)\s+"(?:nuget|dotnet):[^"]+"\s*$/,
      value: (s: string) => s.trim().slice(1, -1),
    },
    unknown: { match: /[^]/, lineBreaks: true },
  },
});

function parseDependencyLine(line: string): PackageDependency | null {
  try {
    let url = line.replace(/^[^:]*:/, '');
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
  lexer.reset();
  return { deps };
}
