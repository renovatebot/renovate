import is from '@sindresorhus/is';
import { getDep } from '../../../dockerfile/extract';
import type { PackageDependency } from '../../../types';
import { DependencyExtractor } from '../../base';
import { generic_image_resource } from './utils';

export class GenericDockerImageRef extends DependencyExtractor {
  getCheckList(): string[] {
    return generic_image_resource.map((value) => `"${value.type}"`);
  }

  extract(hclMap: any): PackageDependency[] {
    const resourceTypMap = hclMap.resource;
    if (is.nullOrUndefined(resourceTypMap)) {
      return [];
    }

    const dependencies = [];

    for (const image_resource_def of generic_image_resource) {
      const { type, path } = image_resource_def;
      const resourceInstancesMap = resourceTypMap[type];
      // is there a resource with current looked at type ( `image_resource_def` )
      if (is.nullOrUndefined(resourceInstancesMap)) {
        continue;
      }

      // loop over instances of a resource type
      for (const instanceName of Object.keys(resourceInstancesMap)) {
        const instanceList = resourceInstancesMap[instanceName];
        for (const instance of instanceList) {
          dependencies.push(
            ...this.walkPath({ depType: type }, instance, path)
          );
        }
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
    parentElement: any,
    leftPath: string[]
  ): PackageDependency[] {
    const dependencies: PackageDependency[] = [];
    // if there are no path elements left, we have reached the end of the path
    if (leftPath.length === 0) {
      // istanbul ignore if
      if (is.nullOrUndefined(parentElement)) {
        return [
          {
            ...abstractDep,
            skipReason: 'invalid-dependency-specification',
          },
        ];
      }
      const test = getDep(parentElement);
      const dep: PackageDependency = {
        ...abstractDep,
        ...test,
      };
      return [dep];
    }

    // is this a list iterator
    const pathElement = leftPath[0];

    // get sub element
    const element = parentElement[pathElement];
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
          ...this.walkPath(abstractDep, arrayElement, leftPath.slice(1))
        );
      }
      return dependencies;
    }
    return this.walkPath(abstractDep, element, leftPath.slice(1));
  }
}
