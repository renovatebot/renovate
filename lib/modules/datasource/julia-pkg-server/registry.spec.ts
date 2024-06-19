import { fs as memfs } from 'memfs';
import { Fixtures, buildTarball } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import { logger } from '../../../../test/util';
import { Http } from '../../../util/http';
import {
  buildRegistryUrl,
  juliaPkgServerDatasourceId,
  defaultPkgServer as pkgServer,
  generalRegistryUUID as registryUuid,
} from './common';
import {
  extractFilesFromTarball,
  parseRegistryUrl,
  registryPathForPackage,
  retrieveRegistryState,
} from './registry';

jest.mock('fs', () => memfs);

const datasource = juliaPkgServerDatasourceId;
const eagerRegistriesPath = '/registries.eager';
const http = new Http(datasource);
const sha1State = '1234567890abcdef1234567890abcdef12345678';

describe('modules/datasource/julia-pkg-server/registry', () => {
  describe('extractFilesFromTarball', () => {
    const fixtureName = 'ExtractFilesFixture';
    const existingFile = 'some/file';
    const existingFileContent = 'Some Content';

    let tarball: Buffer;

    afterAll(() => Fixtures.reset());

    beforeAll(async () => {
      Fixtures.mock({
        [`${fixtureName}/${existingFile}`]: existingFileContent,
      });

      tarball = await buildTarball(fixtureName);
    });

    it('extracts requested files if available', async () => {
      const fileContents = await extractFilesFromTarball(tarball, [
        existingFile,
      ]);

      expect(fileContents).toContainKey(existingFile);

      const existingFileContents = fileContents?.[existingFile];
      expect(existingFileContents).toContain(existingFileContent);
    });

    it('returns null if no files are requested for extraction', async () => {
      expect(await extractFilesFromTarball(tarball, [])).toBeNull();
    });

    it('returns null if not all files could be extracted', async () => {
      const nonExistentFile = 'does/not/exist';
      const files = [existingFile, nonExistentFile];

      expect(await extractFilesFromTarball(tarball, files)).toBeNull();
    });
  });

  describe('parseRegistryUrl', () => {
    it('parses a fully specified URL', async () => {
      const registryUrl = buildRegistryUrl(pkgServer, registryUuid, sha1State);

      expect(await parseRegistryUrl(http, registryUrl)).toEqual({
        pkgServer,
        state: sha1State,
        uuid: registryUuid,
      });
    });

    it('handles (optional) trailing slashes', async () => {
      const registryUrl = `${buildRegistryUrl(pkgServer, registryUuid, sha1State)}/`;

      expect(await parseRegistryUrl(http, registryUrl)).toEqual({
        pkgServer,
        state: sha1State,
        uuid: registryUuid,
      });
    });

    it('handles SHA-256 state', async () => {
      // A SHA-256 is 64 hexadecimal characters. SHA-1 uses 40
      const sha256State = `${sha1State}${sha1State.substring(0, 24)}`;
      const registryUrl = buildRegistryUrl(
        pkgServer,
        registryUuid,
        sha256State,
      );

      expect(await parseRegistryUrl(http, registryUrl)).toEqual({
        pkgServer,
        state: sha256State,
        uuid: registryUuid,
      });
    });

    it('returns null for wrong URLs', async () => {
      const registryUrl = 'https://foo.bar/not-a-registry-path';

      expect(await parseRegistryUrl(http, registryUrl)).toBeNull();

      expect(logger.logger.warn).toHaveBeenCalledWith(
        {
          datasource,
          registryUrl,
        },
        'An invalid registry URL was specified',
      );
    });

    it('gracefully handles unspecified inputs', async () => {
      expect(await parseRegistryUrl(http)).toBeNull();

      expect(logger.logger.warn).toHaveBeenCalledWith(
        {
          datasource,
          registryUrl: undefined,
        },
        'An invalid registry URL was specified',
      );
    });

    describe('missing state from registryUrl', () => {
      it('retrieves the state from the PkgServer', async () => {
        const registryPath = `/registry/${registryUuid}`;
        const registryPathWithState = `${registryPath}/${sha1State}\n`;
        const registryUrl = `${pkgServer}${registryPath}`;

        httpMock
          .scope(pkgServer)
          .get(eagerRegistriesPath)
          .reply(200, registryPathWithState);

        expect(await parseRegistryUrl(http, registryUrl)).toEqual({
          pkgServer,
          state: sha1State,
          uuid: registryUuid,
        });
      });

      it('returns null if the state cannot be retrieved', async () => {
        const registryUrl = buildRegistryUrl(pkgServer, registryUuid);

        httpMock.scope(pkgServer).get(eagerRegistriesPath).reply(404);

        expect(await parseRegistryUrl(http, registryUrl)).toBeNull();
      });
    });
  });

  describe('registryPathForPackage', () => {
    it('handles CamelCased package names', () => {
      expect(registryPathForPackage('HTTP')).toBe('H/HTTP');
    });

    it('handles package names starting with a lowercase letter', () => {
      // An uncommon scenario, but allowed. Needs to be a separate case due to
      // how it affects the storage location within the registry
      expect(registryPathForPackage('gRPCClient')).toBe('G/gRPCClient');
    });

    it('handles JLL packages', () => {
      // JLL packages are stored in a dedicated folder which in turn mimics the
      // top-level registry format
      expect(registryPathForPackage('fzf_jll')).toBe('jll/F/fzf_jll');
    });
  });

  describe('retrieveRegistryState', () => {
    it('retrieves the state for a valid registry', async () => {
      const registryPathWithState = `/registry/${registryUuid}/${sha1State}\n`;

      httpMock
        .scope(pkgServer)
        .get(eagerRegistriesPath)
        .reply(200, registryPathWithState);

      expect(
        await retrieveRegistryState(http, { pkgServer, uuid: registryUuid }),
      ).toBe(sha1State);
    });

    it('returns null when the registries overview cannot be fetched', async () => {
      httpMock.scope(pkgServer).get(eagerRegistriesPath).reply(404);

      expect(
        await retrieveRegistryState(http, { pkgServer, uuid: registryUuid }),
      ).toBeNull();
    });

    it('returns null when the requested registry is not hosted by the PkgServer', async () => {
      const hostedRegistryUuid = '111111111111-1111-1111-1111-11111111';
      const registryPathWithState = `/registry/${hostedRegistryUuid}/${sha1State}\n`;

      httpMock
        .scope(pkgServer)
        .get(eagerRegistriesPath)
        .reply(200, registryPathWithState);

      expect(
        await retrieveRegistryState(http, { pkgServer, uuid: registryUuid }),
      ).toBeNull();

      expect(logger.logger.warn).toHaveBeenCalledWith(
        {
          datasource,
          pkgServer,
          registryUuid,
        },
        'The requested registry does not appear to be hosted by the PkgServer',
      );
    });
  });
});
