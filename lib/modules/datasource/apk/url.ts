import { isNotNullOrUndefined } from '../../../util/array.ts';
import { regEx } from '../../../util/regex.ts';
import { joinUrlParts, parseUrl } from '../../../util/url.ts';

const REQUIRED_PARAMS = ['arch'];
const OPTIONAL_PARAMS = ['branch', 'components'];
const KNOWN_PARAMS = [...REQUIRED_PARAMS, ...OPTIONAL_PARAMS];

// Parameter values become path segments verbatim, so anything which could escape
// or reshape the resulting URL is rejected
const validSegment = regEx(/^[A-Za-z0-9][A-Za-z0-9._+-]*$/);

/**
 * Constructs the `APKINDEX` directory URLs from the given registry URL.
 *
 * @param registryUrl - The base URL of the registry, with the path segments encoded as query parameters.
 * @returns One URL per component.
 * @throws Will throw an error if the registry URL cannot be parsed, or if the query
 * parameters are missing, unknown or malformed.
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
      throw new Error('Cannot parse URL');
    }

    validateParams(url);

    const arch = validateSegment('arch', url.searchParams.get('arch')!);
    const branch = getBranch(url);
    const components = getComponents(url);

    // The parameters describe the path, so they are stripped before the segments
    // are appended. Unknown parameters are rejected above, so nothing else remains.
    for (const param of KNOWN_PARAMS) {
      url.searchParams.delete(param);
    }
    url.hash = '';
    const baseUrl = url.toString();

    return components.map((component) =>
      joinUrlParts(
        baseUrl,
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
 * Validates that the required parameters are present, and that no unknown parameters are given.
 *
 * Unknown parameters are rejected so that a typo such as `component=main` fails loudly
 * instead of being silently treated as a repository without components.
 *
 * @param url - The URL to validate.
 * @throws Will throw an error if a required parameter is missing or an unknown parameter is present.
 */
function validateParams(url: URL): void {
  for (const param of REQUIRED_PARAMS) {
    if (!url.searchParams.has(param)) {
      throw new Error(`Missing required query parameter '${param}'`);
    }
  }

  for (const param of url.searchParams.keys()) {
    if (!KNOWN_PARAMS.includes(param)) {
      throw new Error(`Unknown query parameter '${param}'`);
    }
  }
}

/**
 * Validates a single parameter value which is used as a path segment.
 *
 * @param param - The name of the query parameter, used for the error message.
 * @param value - The value to validate.
 * @returns The validated value.
 * @throws Will throw an error if the value is not usable as a path segment.
 */
function validateSegment(param: string, value: string): string {
  if (!validSegment.test(value)) {
    throw new Error(`Invalid '${param}' query parameter: '${value}'`);
  }

  return value;
}

/**
 * Retrieves the branch from the URL.
 *
 * Repositories such as Wolfi have no branch in their path, so `null` is returned
 * when `branch` is absent.
 *
 * @param url - The URL to retrieve the branch from.
 * @returns The branch, or `null` when there is none.
 */
function getBranch(url: URL): string | null {
  const branch = url.searchParams.get('branch');

  return branch === null ? null : validateSegment('branch', branch);
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
    .filter((component) => component !== '')
    .map((component) => validateSegment('components', component));

  return components?.length ? components : [undefined];
}
