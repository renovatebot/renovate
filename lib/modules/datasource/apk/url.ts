import { isNotNullOrUndefined } from '../../../util/array.ts';
import { joinUrlParts, parseUrl } from '../../../util/url.ts';

const REQUIRED_PARAMS = ['arch'];
const OPTIONAL_PARAMS = ['branch', 'components'];

/**
 * Constructs the `APKINDEX` directory URLs from the given registry URL.
 *
 * @param registryUrl - The base URL of the registry, with the path segments encoded as query parameters.
 * @returns One URL per component, or an empty array if the registry URL cannot be parsed.
 * @throws Will throw an error if required parameters are missing from the URL.
 *
 * @example
 * // Returns ['https://dl-cdn.alpinelinux.org/alpine/v3.19/main/x86_64',
 * //          'https://dl-cdn.alpinelinux.org/alpine/v3.19/community/x86_64']
 * constructComponentUrls('https://dl-cdn.alpinelinux.org/alpine?branch=v3.19&components=main,community&arch=x86_64');
 */
export function constructComponentUrls(registryUrl: string): string[] {
  try {
    const url = parseUrl(registryUrl);
    if (!url) {
      return [];
    }

    validateUrlAndParams(url, REQUIRED_PARAMS);

    const arch = url.searchParams.get('arch')!;
    const branch = url.searchParams.get('branch');
    const components = getComponents(url);

    // Clean up URL search parameters for constructing new URLs
    [...REQUIRED_PARAMS, ...OPTIONAL_PARAMS].forEach((param) =>
      url.searchParams.delete(param),
    );

    return components.map((component) =>
      joinUrlParts(
        url.toString(),
        ...[branch, component, arch].filter(isNotNullOrUndefined),
      ),
    );
  } catch (error) {
    throw new Error(
      `Invalid apk repo URL: ${registryUrl} - see documentation: ${error.message}`,
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
 * Retrieves the components from the URL.
 *
 * Repositories such as Wolfi serve their index directly below the repository
 * root, so a single component-less URL is returned when `components` is absent.
 *
 * @param url - The URL to retrieve the components from.
 * @returns The list of components, or `[undefined]` when there are none.
 */
function getComponents(url: URL): (string | undefined)[] {
  const components = url.searchParams
    .get('components')
    ?.split(',')
    .map((component) => component.trim())
    .filter((component) => component !== '');

  return components?.length ? components : [undefined];
}
