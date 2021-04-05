import { readFileSync } from 'fs';
import { resolve } from 'upath';
import * as httpMock from '../../../../../test/http-mock';
import { getName } from '../../../../../test/util';
import { clone } from '../../../../util/clone';
import type { UpdateLockedConfig } from '../../../types';
import { updateLockedDependency } from '.';

const packageFileContent = readFileSync(
  resolve(__dirname, './__fixtures__/package.json'),
  'utf8'
);
const lockFileContent = readFileSync(
  resolve(__dirname, './__fixtures__/package-lock.json'),
  'utf8'
);

const acceptsJson = JSON.parse(
  readFileSync(resolve(__dirname, './__fixtures__/accepts.json'), 'utf8')
);

const expressJson = JSON.parse(
  readFileSync(resolve(__dirname, './__fixtures__/express.json'), 'utf8')
);

const mimeJson = JSON.parse(
  readFileSync(resolve(__dirname, './__fixtures__/mime.json'), 'utf8')
);

const serveStaticJson = JSON.parse(
  readFileSync(resolve(__dirname, './__fixtures__/serve-static.json'), 'utf8')
);

const sendJson = JSON.parse(
  readFileSync(resolve(__dirname, './__fixtures__/send.json'), 'utf8')
);

const typeIsJson = JSON.parse(
  readFileSync(resolve(__dirname, './__fixtures__/type-is.json'), 'utf8')
);

describe(getName(__filename), () => {
  describe('updateLockedDependency()', () => {
    let config: UpdateLockedConfig;
    beforeEach(() => {
      httpMock.setup();
      config = {
        packageFile: 'package.json',
        packageFileContent,
        lockFile: 'package-lock.json',
        lockFileContent,
        depName: 'some-dep',
        currentVersion: '1.0.0',
        newVersion: '1.0.1',
      };
    });
    afterEach(() => {
      httpMock.reset();
    });
    it('validates filename', async () => {
      expect(
        await updateLockedDependency({ ...config, lockFile: 'yarn.lock' })
      ).toBeNull();
    });
    it('validates versions', async () => {
      expect(
        await updateLockedDependency({
          ...config,
          newVersion: '^2.0.0',
        })
      ).toBeNull();
    });
    it('returns null for unparseable files', async () => {
      expect(
        await updateLockedDependency({ ...config, lockFileContent: 'not json' })
      ).toBeNull();
    });
    it('rejects lockFileVersion 2', async () => {
      expect(
        await updateLockedDependency({
          ...config,
          lockFileContent: lockFileContent.replace(': 1,', ': 2,'),
        })
      ).toBeNull();
    });
    it('returns null if no locked deps', async () => {
      expect(await updateLockedDependency(config)).toBeNull();
    });
    it('rejects null if no constraint found', async () => {
      expect(
        await updateLockedDependency({
          ...config,
          lockFileContent: lockFileContent.replace('1.0.0', '10.0.0'),
          depName: 'accepts',
          currentVersion: '10.0.0',
          newVersion: '11.0.0',
        })
      ).toBeNull();
    });
    it('remediates in-range', async () => {
      const res = await updateLockedDependency({
        ...config,
        depName: 'mime',
        currentVersion: '1.2.11',
        newVersion: '1.2.12',
      });
      expect(
        JSON.parse(res['package-lock.json']).dependencies.mime.version
      ).toEqual('1.2.12');
    });
    it('fails to remediate if parent dep cannot support', async () => {
      const acceptsModified = clone(acceptsJson);
      acceptsModified.versions['2.0.0'] = {};
      httpMock
        .scope('https://registry.npmjs.org')
        .get('/accepts')
        .reply(200, acceptsModified);
      httpMock
        .scope('https://registry.npmjs.org')
        .get('/express')
        .reply(200, expressJson);
      const res = await updateLockedDependency({
        ...config,
        depName: 'accepts',
        currentVersion: '1.0.0',
        newVersion: '2.0.0',
      });
      expect(res).toBeNull();
    });
    it('remediates express', async () => {
      config.depName = 'express';
      config.currentVersion = '4.0.0';
      config.newVersion = '4.1.0';
      const res = await updateLockedDependency(config);
      expect(res['package.json']).toContain('"express": "4.1.0"');
      const packageLock = JSON.parse(res['package-lock.json']);
      expect(packageLock.dependencies.express.version).toEqual('4.1.0');
    });
    it('remediates mime', async () => {
      config.depName = 'mime';
      config.currentVersion = '1.2.11';
      config.newVersion = '1.4.1';
      httpMock
        .scope('https://registry.npmjs.org')
        .get('/accepts')
        .reply(200, acceptsJson);
      httpMock
        .scope('https://registry.npmjs.org')
        .get('/express')
        .reply(200, expressJson);
      httpMock
        .scope('https://registry.npmjs.org')
        .get('/mime')
        .reply(200, mimeJson);
      httpMock
        .scope('https://registry.npmjs.org')
        .get('/send')
        .reply(200, sendJson);
      httpMock
        .scope('https://registry.npmjs.org')
        .get('/serve-static')
        .reply(200, serveStaticJson);
      httpMock
        .scope('https://registry.npmjs.org')
        .get('/type-is')
        .reply(200, typeIsJson);
      const res = await updateLockedDependency(config);
      const packageLock = JSON.parse(res['package-lock.json']);
      expect(packageLock.dependencies.mime.version).toEqual('1.4.1');
      expect(packageLock.dependencies.express.version).toEqual('4.16.0');
    });
  });
});
