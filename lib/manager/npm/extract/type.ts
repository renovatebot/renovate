import { NpmPackage } from './common';

export function mightBeABrowserLibrary(packageJson: NpmPackage): boolean {
  // return true unless we're sure it's not a browser library
  if (packageJson.private === true) {
    // it's not published
    return false;
  }
  if (
    packageJson.main === undefined &&
    packageJson.module === undefined &&
    packageJson.bin === undefined
  ) {
    // it can't be required nor does it have a binary
    return false;
  }
  // TODO: how can we know if it's a node.js library only, and not browser?
  // Otherwise play it safe and return true
  return true;
}
