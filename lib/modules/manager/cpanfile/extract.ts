import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { newlineRegex, regEx } from '../../../util/regex';
import { CpanDatasource } from '../../datasource/cpan';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import * as perlVersioning from '../../versioning/perl';
import type { PackageDependency, PackageFileContent } from '../types';
import { extractPerlVersion, formatContent } from './common';

export async function extractPackageFile(
  content: string,
  fileName?: string
): Promise<PackageFileContent | null> {
  const res: PackageFileContent = {
    deps: [],
  };
  const lines = content.split(newlineRegex);
  for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
    const line = lines[lineNumber];

    const perlMatch = extractPerlVersion(line);
    if (perlMatch) {
      res.deps.push({
        depName: 'perl',
        packageName: 'Perl/perl5',
        currentValue: perlMatch,
        datasource: GithubTagsDatasource.id,
        versioning: perlVersioning.id,
        extractVersion: '^v(?<version>\\S+)',
      });
      continue;
    }

    const moduleMatchRegex = regEx(
      `^\\s*(((?<phase>configure|build|test|author)_)?requires|recommends|suggests)\\s+['"](?<depName>[^'"]+)['"](\\s*(,|=>)\\s*['"]?(==|>=|>)?\\s*v?(?<currentValue>[^'"]+)['"]?)?;`
    );
    const moduleMatch = moduleMatchRegex.exec(line);
    if (moduleMatch) {
      const dep: PackageDependency = {
        depName: moduleMatch.groups?.depName,
      };
      if (moduleMatch.groups?.currentValue) {
        const currentValue = moduleMatch.groups.currentValue;
        dep.currentValue = currentValue;
      }
      if (moduleMatch.groups?.phase) {
        dep.depType = moduleMatch.groups.phase.replace(/author/, 'develop');
      }
      dep.datasource = CpanDatasource.id;
      res.deps.push(dep);
    }

    const phaseMatch = regEx(/^on\s+['"]?([^'"]+)['"]?\s+=>\s+sub\s+{/).exec(
      line
    );
    if (phaseMatch) {
      const phase = phaseMatch[1];
      let phaseContent = '';
      let phaseLine = '';
      while (lineNumber < lines.length && phaseLine !== '};') {
        lineNumber += 1;
        phaseLine = lines[lineNumber];
        // istanbul ignore if
        if (!is.string(phaseLine)) {
          logger.warn(
            { content, fileName, type: 'phaseLine' },
            'cpanfile parsing error'
          );
          phaseLine = '};';
        }
        if (phaseLine !== '};') {
          phaseContent += formatContent(phaseLine);
        }
      }
      const phaseRes = await extractPackageFile(phaseContent);
      if (phaseRes) {
        res.deps = res.deps.concat(
          phaseRes.deps.map((dep) => ({
            ...dep,
            depType: phase,
          }))
        );
      }
    }
  }
  if (!res.deps.length) {
    return null;
  }

  return res;
}
