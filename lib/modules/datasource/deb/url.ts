import { logger } from '../../../logger';
import { joinUrlParts } from '../../../util/url';

/**
 * Extracts the base suite URL from a package URL by removing the last two path segments.
 *
 * @param basePackageUrl - The base URL of the package.
 * @returns The base suite URL.
 *
 * @example
 * // Returns 'https://deb.debian.org/debian/dists/bullseye'
 * getBaseReleaseUrl('https://deb.debian.org/debian/dists/bullseye/main/binary-amd64');
 */
export function getBaseSuiteUrl(basePackageUrl: string): string {
  const urlParts = basePackageUrl.split('/');
  return urlParts.slice(0, urlParts.length - 2).join('/');
}

/**
 * Constructs the component URLs from the given registry URL.
 *
 * @param registryUrl - The base URL of the registry.
 * @returns An array of component URLs.
 * @throws Will throw an error if required parameters are missing from the URL.
 */
export function constructComponentUrls(registryUrl: string): string[] {
  const REQUIRED_PARAMS = ['components', 'binaryArch'];
  const OPTIONAL_PARAMS = ['suite', 'release'];

  try {
    const url = new URL(registryUrl);
    validateUrlAndParams(url, REQUIRED_PARAMS);

    const suite = getReleaseParam(url, OPTIONAL_PARAMS);
    const binaryArch = url.searchParams.get('binaryArch');
    const components = url.searchParams.get('components')!.split(',');

    // Clean up URL search parameters for constructing new URLs
    [...REQUIRED_PARAMS, ...OPTIONAL_PARAMS].forEach((param) =>
      url.searchParams.delete(param),
    );

    return components.map((component) =>
      joinUrlParts(
        url.toString(),
        `dists`,
        suite,
        component,
        `binary-${binaryArch}`,
      ),
    );
  } catch (error) {
    throw new Error(
      `Invalid deb repo URL: ${registryUrl} - see documentation: ${error.message}`,
    );
  }
}

/**
 * Validates that the required parameters are present in the URL.
 *
 * @param url - The URL to validate.
 * @param requiredParams - The list of required query parameters.
 * @throws Will throw an error if a required parameter is missing.
 */
function validateUrlAndParams(url: URL, requiredParams: string[]): void {
  for (const param of requiredParams) {
    if (!url.searchParams.has(param)) {
      throw new Error(`Missing required query parameter '${param}'`);
    }
  }
}

/**
 * Retrieves the suite parameter from the URL.
 *
 * @param url - The URL to retrieve the suite parameter from.
 * @param optionalParams - The list of optional query parameters.
 * @returns The value of the suite parameter.
 * @throws Will throw an error if none of the optional parameters are found.
 */
function getReleaseParam(url: URL, optionalParams: string[]): string {
  for (const param of optionalParams) {
    const paramValue = url.searchParams.get(param);
    if (paramValue !== null) {
      if (param === 'release') {
        logger.debug(
          'Deprecation notice. Use `suite` instead of `release` for deb repo URLs',
        );
      }
      return paramValue;
    }
  }
  throw new Error(`Missing one of suite query parameter`);
}
