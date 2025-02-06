/**
 * Represents the structure of a package description extracted from a Package Index file.
 *
 * A Package Index file contains multiple package descriptions, with each package description
 * separated by a completely empty line. Each package description provides meta-data
 * about a specific package, with properties in the following format:
 *
 * ```
 * PropertyName: value
 * ```
 *
 * @example
 *
 * ```
 * Package: album
 * Version: 4.15-1
 * Homepage: http://marginalhacks.com/Hacks/album
 *
 * Package: album-data
 * Version: 4.05-7.2
 * Homepage: http://marginalhacks.com/Hacks/album
 * ```
 *
 * Some property are optional and may not be present in a package description.
 */
export interface PackageDescription {
  Package?: string;
  Version?: string;
  Homepage?: string;
}
