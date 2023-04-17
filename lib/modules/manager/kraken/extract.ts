import { lang, lexer, query as q } from 'good-enough-parser';
import { logger } from '../../../logger';
import { regEx } from '../../../util/regex';
import { PypiDatasource } from '../../datasource/pypi';
import { dependencyPattern, packagePattern } from '../pip_requirements/extract';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types';

const pkgRegex = regEx(`^(${packagePattern})$`);
const pkgValRegex = regEx(`^${dependencyPattern}$`);

function addDependency(ctx: Context, { value }: lexer.Token): Context {
  let dep: PackageDependency = {};
  const packageMatches = pkgValRegex.exec(value) ?? pkgRegex.exec(value);
  if (!packageMatches) {
    logger.debug(`Cannot extract package name from ${value} dependency`);
    return ctx;
  }

  const [, depName, , currVal] = packageMatches;
  const currentValue = currVal ? currVal.trim() : '';

  dep = {
    depName,
    currentValue,
    datasource: PypiDatasource.id,
  };
  ctx.deps.push(dep);
  return ctx;
}

const python = lang.createLang('python');

const qIndexUrl = q
  .sym<Context>('index_url')
  .op('=')
  .str((ctx: Context, { value: varName }) => {
    ctx.registryUrls = [varName];
    return ctx;
  });

const qRequirements = q
  .sym<Context>('requirements')
  .op('=')
  .tree({
    type: 'wrapped-tree',
    startsWith: '[',
    endsWith: ']',
    search: q.str(addDependency),
  });

const qBuildscript = q.sym<Context>('buildscript').tree({
  type: 'wrapped-tree',
  startsWith: '(',
  endsWith: ')',
  search: q.alt(qIndexUrl, qRequirements),
});

type Context = PackageFileContent;

export function extractPackageFile(
  content: string,
  fileName: string,
  _config?: ExtractConfig
): PackageFileContent | null {
  logger.info(`kraken.extractPackageFile(${fileName})`);
  const res = python.query(content, qBuildscript, { deps: [] });
  return res?.deps?.length ? res : null;
}
