/**
 * A package file contains multiple package descriptions which are each separated by an completely empty line.
 * A package description contains meta data properties in the form of
 *
 * PropertyName: value
 */
export interface PackageDescription {
  Package?: string; // Package
  Version?: string; // Version
  Homepage?: string; // Homepage
}
