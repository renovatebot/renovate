import * as npmVersioning from '../../versioning/npm';

export { resetMemCache, resetCache } from './get';
export { getReleases } from './releases';
export { getNpmrc, setNpmrc } from './npmrc';
export { id } from './common';
export const defaultVersioning = npmVersioning.id;
export const customRegistrySupport = false;
