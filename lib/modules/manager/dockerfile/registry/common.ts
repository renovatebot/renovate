/**
 * The architecture the detected repositories are read for.
 *
 * A Dockerfile does not say which architectures it is built for, so the most
 * common one is assumed - override it with a `packageRules` entry when you
 * build for another.
 */
export const arch = 'x86_64';
export const binaryArch = 'amd64';
