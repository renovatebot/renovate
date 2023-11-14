import { updateLockedDependency } from '../..';
import { Fixtures } from '../../../../../../test/fixtures';
import * as httpMock from '../../../../../../test/http-mock';
import { clone } from '../../../../../util/clone';
import type { UpdateLockedConfig } from '../../../types';

const packageFileContent = Fixtures.get('package.json', './package-lock');
const lockFileContent = Fixtures.get('package-lock-v1.json', './package-lock');
const lockFileV2Content = Fixtures.get(
  'package-lock-v2.json',
  './package-lock',
);
const acceptsJson = Fixtures.getJson('accepts.json', './package-lock');
const expressJson = Fixtures.get('express.json', './common');
const mimeJson = Fixtures.get('mime.json', './package-lock');
const serveStaticJson = Fixtures.get('serve-static.json', './package-lock');
const sendJson = Fixtures.get('send.json', './package-lock');
const typeIsJson = Fixtures.getJson('type-is.json', './package-lock');
const bundledPackageJson = Fixtures.get(
  'bundled.package.json',
  './package-lock',
);
const bundledPackageLockJson = Fixtures.get(
  'bundled.package-lock.json',
  './package-lock',
);

describe('modules/manager/npm/update/locked-dependency/index', () => {
  describe('updateLockedDependency()', () => {
    let config: UpdateLockedConfig;

    beforeEach(() => {
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

    it('validates filename', async () => {
      expect(
        await updateLockedDependency({ ...config, lockFile: 'yarn.lock' }),
      ).toMatchObject({});
      expect(
        await updateLockedDependency({ ...config, lockFile: 'yarn.lock2' }),
      ).toMatchObject({});
    });

    it('validates versions', async () => {
      expect(
        await updateLockedDependency({
          ...config,
          newVersion: '^2.0.0',
        }),
      ).toMatchObject({});
    });

    it('returns null for unparseable files', async () => {
      expect(
        await updateLockedDependency({
          ...config,
          lockFileContent: 'not json',
        }),
      ).toMatchObject({});
    });

    it('rejects lockFileVersion 2', async () => {
      expect(
        await updateLockedDependency({
          ...config,
          lockFileContent: lockFileContent.replace(': 1,', ': 2,'),
        }),
      ).toMatchObject({});
    });

    it('returns null if no locked deps', async () => {
      expect(await updateLockedDependency(config)).toMatchObject({});
    });

    it('rejects null if no constraint found', async () => {
      expect(
        await updateLockedDependency({
          ...config,
          lockFileContent: lockFileContent.replace('1.0.0', '10.0.0'),
          depName: 'accepts',
          currentVersion: '10.0.0',
          newVersion: '11.0.0',
        }),
      ).toMatchObject({});
    });

    it('remediates in-range', async () => {
      const res = await updateLockedDependency({
        ...config,
        depName: 'mime',
        currentVersion: '1.2.11',
        newVersion: '1.2.12',
      });
      expect(
        JSON.parse(res.files!['package-lock.json']).dependencies.mime.version,
      ).toBe('1.2.12');
    });

    it('rejects in-range remediation if lockfile v2+', async () => {
      const res = await updateLockedDependency({
        ...config,
        lockFileContent: lockFileV2Content,
        depName: 'mime',
        currentVersion: '1.2.11',
        newVersion: '1.2.12',
      });
      expect(res.status).toBe('unsupported');
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
      expect(res).toMatchObject({});
    });

    it('remediates express', async () => {
      config.depName = 'express';
      config.currentVersion = '4.0.0';
      config.newVersion = '4.1.0';
      const res = await updateLockedDependency(config);
      expect(res.files!['package.json']).toContain('"express": "4.1.0"');
      const packageLock = JSON.parse(res.files!['package-lock.json']);
      expect(packageLock.dependencies.express.version).toBe('4.1.0');
    });

    it('remediates lock file v2 express', async () => {
      config.depName = 'express';
      config.currentVersion = '4.0.0';
      config.newVersion = '4.1.0';
      config.lockFileContent = lockFileV2Content;
      const res = await updateLockedDependency(config);
      expect(res.files!['package.json']).toContain('"express": "4.1.0"');
      const packageLock = JSON.parse(res.files!['package-lock.json']);
      expect(packageLock.dependencies.express.version).toBe('4.1.0');
    });

    it('returns already-updated if already remediated exactly', async () => {
      config.depName = 'mime';
      config.currentVersion = '1.2.10';
      config.newVersion = '1.2.11';
      const res = await updateLockedDependency(config);
      expect(res.status).toBe('already-updated');
    });

    it('returns already-updated if already v2 remediated exactly', async () => {
      config.depName = 'mime';
      config.currentVersion = '1.2.10';
      config.newVersion = '1.2.11';
      config.lockFileContent = lockFileV2Content;
      const res = await updateLockedDependency(config);
      expect(res.status).toBe('already-updated');
    });

    it('returns already-updated if already remediated higher', async () => {
      config.depName = 'mime';
      config.currentVersion = '1.2.9';
      config.newVersion = '1.2.10';
      config.allowHigherOrRemoved = true;
      const res = await updateLockedDependency(config);
      expect(res.status).toBe('already-updated');
    });

    it('returns already-updated if not found', async () => {
      config.depName = 'notfound';
      config.currentVersion = '1.2.9';
      config.newVersion = '1.2.10';
      config.allowHigherOrRemoved = true;
      const res = await updateLockedDependency(config);
      expect(res.status).toBe('already-updated');
    });

    it('returns update-failed if other, lower version found', async () => {
      config.depName = 'mime';
      config.currentVersion = '1.2.5';
      config.newVersion = '1.2.15';
      config.allowHigherOrRemoved = true;
      const res = await updateLockedDependency(config);
      expect(res.status).toBe('update-failed');
    });

    it('remediates mime', async () => {
      config.depName = 'mime';
      config.currentVersion = '1.2.11';
      config.newVersion = '1.4.1';
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
      const packageLock = JSON.parse(res.files!['package-lock.json']);
      expect(packageLock.dependencies.mime.version).toBe('1.4.1');
      expect(packageLock.dependencies.express.version).toBe('4.16.0');
    });

    it('fails remediation if cannot update parent', async () => {
      config.depName = 'mime';
      config.currentVersion = '1.2.11';
      config.newVersion = '1.4.1';
      config.allowParentUpdates = false;
      const res = await updateLockedDependency(config);
      expect(res.status).toBe('update-failed');
    });

    it('fails remediation if bundled', async () => {
      config.depName = 'ansi-regex';
      config.currentVersion = '3.0.0';
      config.newVersion = '5.0.1';
      config.packageFileContent = bundledPackageJson;
      config.lockFileContent = bundledPackageLockJson;
      const res = await updateLockedDependency(config);
      expect(res.status).toBe('update-failed');
    });
  });
});
