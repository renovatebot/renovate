import is from '@sindresorhus/is';
import { getDep } from '../../../dockerfile/extract';
import type { ExtractConfig, PackageDependency } from '../../../types';
import { DependencyExtractor } from '../../base';
import type { TerraformDefinitionFile } from '../../hcl/types';
import type { ProviderLock } from '../../lockfile/types';
import { generic_image_resource } from './utils';

export class GenericDockerImageRefExtractor extends DependencyExtractor {
  getCheckList(): string[] {
    return generic_image_resource.map((value) => `"${value.type}"`);
  }

  extract(
    hclMap: TerraformDefinitionFile,
    _locks: ProviderLock[],
    config: ExtractConfig,
  ): PackageDependency[] {
    const resourceTypMap = hclMap.resource;
    if (is.nullOrUndefined(resourceTypMap)) {
      return [];
    }

    const dependencies = [];

    for (const image_resource_def of generic_image_resource) {
      const { type, path } = image_resource_def;
      const resourceInstancesMap = resourceTypMap[type];
      // is there a resource with current looked at type ( `image_resource_def` )
      if (!is.nonEmptyObject(resourceInstancesMap)) {
        continue;
      }

      // loop over instances of a resource type
      for (const instance of Object.values(resourceInstancesMap).flat()) {
        dependencies.push(
          ...this.walkPath({ depType: type }, instance, path, config),
        );
      }
    }
    return dependencies;
  }

  /**
   * Recursively follow the path to find elements on the path.
   * If a path element is '*' the parentElement will be interpreted as a list
   * and each element will be followed
   * @param abstractDep dependency which will used as basis for adding attributes
   * @param parentElement element from which the next element will be extracted
   * @param leftPath path elements left to walk down
   */
  private walkPath(
    abstractDep: PackageDependency,
    parentElement: unknown,
    leftPath: string[],
    config: ExtractConfig,
  ): PackageDependency[] {
    const dependencies: PackageDependency[] = [];
    // if there are no path elements left, we have reached the end of the path
    if (leftPath.length === 0) {
      // istanbul ignore if
      if (!is.nonEmptyString(parentElement)) {
        return [
          {
            ...abstractDep,
            skipReason: 'invalid-dependency-specification',
          },
        ];
      }
      const test = getDep(parentElement, true, config.registryAliases);
      const dep: PackageDependency = {
        ...abstractDep,
        ...test,
      };
      return [dep];
    }

    // is this a list iterator
    const pathElement = leftPath[0];

    // get sub element
    const element = is.nonEmptyObject(parentElement)
      ? parentElement[pathElement]
      : null;
    if (is.nullOrUndefined(element)) {
      return leftPath.length === 1 // if this is the last element assume a false defined dependency
        ? [
            {
              ...abstractDep,
              skipReason: 'invalid-dependency-specification',
            },
          ]
        : [];
    }
    if (is.array(element)) {
      for (const arrayElement of element) {
        dependencies.push(
          ...this.walkPath(
            abstractDep,
            arrayElement,
            leftPath.slice(1),
            config,
          ),
        );
      }
      return dependencies;
    }
    return this.walkPath(abstractDep, element, leftPath.slice(1), config);
  }
}
