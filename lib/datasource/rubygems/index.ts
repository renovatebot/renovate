import * as rubyVersioning from '../../versioning/ruby';

export { getReleases } from './releases';
export { id } from './common';
export const customRegistrySupport = true;
export const defaultRegistryUrls = ['https://rubygems.org'];
export const defaultVersioning = rubyVersioning.id;
export const registryStrategy = 'hunt';
