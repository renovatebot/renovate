import { readLocalFile } from '../../../util/fs';
import { parseSingleYaml } from '../../../util/yaml';
import { cacheRepositories, getRepository } from './repository';
import {
  type HelmRepository,
  type PluralFile,
  type PluralResource,
  type RegExpGroups,
  ResourceKind,
  type ServiceDeployment,
} from './types';

const FILE_MATCH_REGEX = '^.*\\.ya?ml$';
const PLURAL_HEADER_REGEX = /apiVersion:\s+deployments.plural.sh\/.+\nkind:\s+(?<resourceKind>.+)/;
const HELM_HEADER_REGEX = /apiVersion:\s+source.toolkit.fluxcd.io\/.+\nkind:\s+(?<resourceKind>.+)/;
const REGISTRY_COMMENT_REGEX = /\s+renovate:\s+registry=(?<registryUrl>.+)/;
const MULTIYAML_SEPARATOR = '---';

function toServices(file: PluralFile): PluralResource | null {
  if (!PLURAL_HEADER_REGEX.test(file.content)) {
    return null;
  }

  return {
    ...file,
    services: file.content
      .split(MULTIYAML_SEPARATOR)
      .filter(resource => (resource.match(PLURAL_HEADER_REGEX) as RegExpGroups<'resourceKind'>)?.groups?.resourceKind === ResourceKind.ServiceDeployment)
      .map(resource => ({ ...(parseSingleYaml(resource) as ServiceDeployment), content: resource })),
  };
}

function toRepositories(file: PluralFile): Array<HelmRepository> | null {
  if (!HELM_HEADER_REGEX.test(file.content)) {
    return null;
  }

  return file.content
    .split(MULTIYAML_SEPARATOR)
    .filter(resource => (resource.match(HELM_HEADER_REGEX) as RegExpGroups<'resourceKind'>)?.groups?.resourceKind === ResourceKind.HelmRepository)
    .map(resource => ({ ...(parseSingleYaml(resource) as HelmRepository), content: resource }));
}

async function toResources(fileNames: string[]): Promise<Array<PluralResource>> {
  const files: Array<PluralFile> = await Promise.all(fileNames
    .map(async file => ({ fileName: file, content: await readLocalFile(file, 'utf8') ?? '' } as PluralFile))
    .filter(async content => !!(await content)));

  cacheRepositories(files.flatMap(toRepositories).filter(notEmpty));

  return files
    .map(toServices)
    .filter(notEmpty);
}

function lookupRepository(service: ServiceDeployment): string {
  const cachedRepository = getRepository(service.spec.helm.repository.name, service.spec.helm.repository.namespace)?.spec?.url ?? ''
  if(cachedRepository) {
    return cachedRepository
  }

  return (service.content.match(REGISTRY_COMMENT_REGEX) as RegExpGroups<'registryUrl'>)?.groups?.registryUrl ?? ''
}

function notEmpty<T>(value: T | null | undefined): value is T {
  return !!value;
}

export { toResources, notEmpty, toServices, lookupRepository, FILE_MATCH_REGEX };
