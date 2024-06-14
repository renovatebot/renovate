import { Parse as tarParse } from 'tar';
import { logger } from '../../../logger';
import type { Http } from '../../../util/http';
import { Result } from '../../../util/result';
import { joinUrlParts } from '../../../util/url';
import {
  PKG_SERVER_REQUEST_HEADERS,
  juliaPkgServerDatasourceId,
} from './common';

/**
 * Generic container to aggregate and pass the contents of files.
 */
interface FileContents<T extends Buffer[] | string> {
  [path: string]: T;
}

/**
 * Wraps all the information necessary to uniquely identify a registry at a
 * particular point in time.
 */
interface JuliaPkgServerRegistry {
  pkgServer: string;
  state: string;
  uuid: string;
}

/**
 * URLs referencing a registry served by a PkgServer take the form:
 * `<PkgServer host>/registry/<registry UUID>/<registry state>`.
 *
 * Although required when querying the state of a registry, the state in the
 * URL is not mandatory when configuring a `registryUrl` passed into the
 * datasource. Therefore that section is marked optional and should be ensured
 * to be filled before further processing.
 */
const PKG_SERVER_REGISTRY_URL_FORMAT = new RegExp(
  '^(?<pkgServer>.+)/registry/(?<uuid>\\p{Hex_Digit}{8}(-\\p{Hex_Digit}{4}){3}-\\p{Hex_Digit}{12})(/(?<state>\\p{Hex_Digit}{40}))?/?$',
  'u',
);

/**
 * The final part of the path of a (fully specified) registry URL references
 * the tree SHA of the state of of the registry repository the package server
 * is serving. Given the content-addressable nature of this SHA, it can be used
 * as a caching mechanism.
 *
 * Cache keys are of the form `<registry UUID>:<registry state>`
 */
export function cacheKeyFromRegistryUrl(url: string): string {
  return url.split('/').slice(-2).join(':');
}

/**
 * Extracts one or more files from the provided tarball in-memory.
 *
 * Returns `null`/fails if not all requested files can be extracted or if no
 * files are requested for extraction.
 */
export async function extractFilesFromTarball(
  tarball: Buffer,
  pathsToExtract: string[],
): Promise<FileContents<string> | null> {
  if (pathsToExtract.length === 0) {
    return null;
  }

  // Block until the content of all files has been (asynchronously) read from
  // the tarball
  return await new Promise<FileContents<string> | null>((resolve, reject) => {
    // File content may be streamed in chunks which need to be aggregated
    // TODO: The tests for this functionality only require a single "chunk" to
    // be read from the tarball to succeed. Hence, it would be sufficient to
    // just process a single chunk directly as a string and return it. This
    // does not hold in general and a (minimal) test requiring multiple chunks
    // should be implemented
    const fileContentChunks: FileContents<Buffer[]> = {};
    for (const path of pathsToExtract) {
      fileContentChunks[path] = [];
    }

    const tarballParser = new tarParse({
      filter: (path) => pathsToExtract.includes(path),
    });

    tarballParser.on('end', () => {
      if (Object.values(fileContentChunks).every(({ length }) => length > 0)) {
        const fileContents: FileContents<string> = {};
        for (const path of pathsToExtract) {
          fileContents[path] = Buffer.concat(fileContentChunks[path]).toString(
            'utf-8',
          );
        }

        resolve(fileContents);
      } else {
        resolve(null);
      }
    });

    tarballParser.on('entry', (entry) => {
      entry.on('data', (data) => {
        fileContentChunks[entry.path].push(data);
      });

      entry.on('error', reject);
    });

    tarballParser.end(tarball);
  });
}

/**
 * Parses the provided `registryUrl` into an object containing all the
 * necessary information to uniquely identify the state of a registry at a
 * particular moment in time.
 *
 * If the `registryUrl` does not specify the state of the registry, the state
 * will be determined by querying the associated PkgServer.
 */
export async function parseRegistryUrl(
  http: Http,
  registryUrl?: string,
): Promise<JuliaPkgServerRegistry | null> {
  const parsedRegistryUrl = registryUrl?.match(PKG_SERVER_REGISTRY_URL_FORMAT);

  if (!parsedRegistryUrl) {
    logger.warn(
      {
        datasource: juliaPkgServerDatasourceId,
        registryUrl,
      },
      'An invalid registry URL was specified',
    );

    return null;
  }

  // The groups will always be specified, as otherwise the URL wouldn't have
  // parsed and the function returned above
  const { pkgServer, state, uuid } = parsedRegistryUrl.groups!;

  if (state) {
    return {
      pkgServer,
      state,
      uuid,
    };
  } else {
    const retrievedState = await retrieveRegistryState(http, {
      pkgServer,
      uuid,
    });

    if (retrievedState) {
      return {
        pkgServer,
        state: retrievedState,
        uuid,
      };
    }
  }

  return null;
}

/**
 * Returns the path for a given package in a Julia package registry.
 *
 * Packages in a Julia package registry are ordered as following:
 * - (uppercased) initial letter at the root of the registry.
 * - Packages tend to use CamelCase for naming, but this is not a rule/requirement.
 * - JLL packages are separated into a `jll` folder at the root of the
 *   registry, with packages further sorted as noted above.
 */
export function registryPathForPackage(name: string): string {
  const initialLetter = name.substring(0, 1).toUpperCase();
  const namespace = name.endsWith('_jll') ? 'jll' : '';
  return joinUrlParts(namespace, initialLetter, name);
}

/**
 * Tries to retrieve the state of the specified registry by querying the
 * associated PkgServer based on the server's URL and a registry's UUID.
 */
export async function retrieveRegistryState(
  http: Http,
  {
    pkgServer,
    uuid: requestedUuid,
  }: Pick<JuliaPkgServerRegistry, 'pkgServer' | 'uuid'>,
): Promise<string | null> {
  // A single package server can support multiple registries and multiple
  // "flavors". The "eager" flavor will provide the most up-to-date state of
  // the hosted registries
  const registriesUrl = joinUrlParts(pkgServer, 'registries.eager');

  const { val: registryStates, err: error } = await Result.wrap(
    http.get(registriesUrl, {
      headers: PKG_SERVER_REQUEST_HEADERS,
    }),
  )
    // The response contains the paths to all registries the package server
    // knows formatted as /registry/<registry uuid>/<registry state sha> on
    // separate lines, including a final newline
    .transform(({ body }) => {
      const registryPaths = body.split('\n').slice(0, -1);

      const registryStates: { [key: string]: string } = {};
      for (const registryPath of registryPaths) {
        const [uuid, state] = registryPath.split('/').slice(-2);
        registryStates[uuid] = state;
      }

      return registryStates;
    })
    .unwrap();

  if (error) {
    logger.warn(
      {
        datasource: juliaPkgServerDatasourceId,
        error,
        pkgServer,
      },
      'An error occurred fetching registries from the PgkServer',
    );

    return null;
  }

  if (registryStates && Object.keys(registryStates).includes(requestedUuid)) {
    return registryStates[requestedUuid];
  }

  logger.warn(
    {
      datasource: juliaPkgServerDatasourceId,
      pkgServer,
      registryUuid: requestedUuid,
    },
    'The requested registry does not appear to be hosted by the PkgServer',
  );

  return null;
}
