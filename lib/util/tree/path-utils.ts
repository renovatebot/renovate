import upath from 'upath';

/**
 * Reframe a relative path from one file to be relative from the root of the repository
 *
 * This utility takes a path that is relative to a specific file and converts it to be
 * relative from the repository root. This is useful when processing dependency references
 * that use relative paths.
 *
 * @param dependentFilePath - Path to the file that contains the relative reference
 * @param relativeReference - The relative path reference to reframe
 * @returns The path reframed to be relative from the repository root
 *
 * @example
 * // Given a go.mod file at "service/go.mod" with a replace directive "../common"
 * reframeRelativePathToRootOfRepo("service/go.mod", "../common")
 * // Returns: "common"
 *
 * @example
 * // Given a file at "deep/nested/package.json" with a reference to "../../utils"
 * reframeRelativePathToRootOfRepo("deep/nested/package.json", "../../utils")
 * // Returns: "utils"
 */
export function reframeRelativePathToRootOfRepo(
  dependentFilePath: string,
  relativeReference: string,
): string {
  // Use a virtual repository root to ensure consistent path resolution
  const virtualRepoRoot = '/';

  // Get the absolute path of the dependent file from the virtual root
  const absoluteDependentFilePath = upath.resolve(
    virtualRepoRoot,
    dependentFilePath,
  );

  // Resolve the relative reference from the dependent file's directory
  const absoluteReferencePath = upath.resolve(
    upath.dirname(absoluteDependentFilePath),
    relativeReference,
  );

  // Convert back to a path relative from the repository root
  const relativeFromRoot = upath.relative(
    virtualRepoRoot,
    absoluteReferencePath,
  );

  return relativeFromRoot;
}
