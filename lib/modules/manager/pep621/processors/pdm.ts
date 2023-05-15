import is from '@sindresorhus/is';
import { PypiDatasource } from '../../../datasource/pypi';
import type { PackageDependency } from '../../types';
import type { PyProject } from '../schema';
import { parseDependencyGroupRecord } from '../utils';
import type { PyProjectProcessor } from './types';

export class PdmProcessor implements PyProjectProcessor {
  process(project: PyProject, deps: PackageDependency[]): PackageDependency[] {
    const pdm = project.tool?.pdm;
    if (is.nullOrUndefined(pdm)) {
      return deps;
    }

    deps.push(
      ...parseDependencyGroupRecord(
        'tool.pdm.dev-dependencies',
        pdm['dev-dependencies']
      )
    );

    const pdmSource = pdm.source;
    if (is.nullOrUndefined(pdmSource)) {
      return deps;
    }

    // add pypi default url, if there is no source declared with the name `pypi`. https://daobook.github.io/pdm/pyproject/tool-pdm/#specify-other-sources-for-finding-packages
    const containsPyPiUrl = pdmSource.some((value) => value.name === 'pypi');
    const registryUrls: string[] = [];
    if (!containsPyPiUrl) {
      registryUrls.push(PypiDatasource.defaultURL);
    }
    for (const source of pdmSource) {
      registryUrls.push(source.url);
    }
    for (const dep of deps) {
      dep.registryUrls = registryUrls;
    }

    return deps;
  }
}
