import { VersioningApi } from '../common';
import * as maven from '../maven';

export const id = 'gradle';
export const displayName = 'Gradle';
export const urls = [
  'https://docs.gradle.org/current/userguide/single_versions.html#version_ordering',
];
export const supportsRanges = false;
export const supportedRangeStrategies = [];

export const api: VersioningApi = maven.api;

export default api;
