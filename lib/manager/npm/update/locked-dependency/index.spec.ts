import * as httpMock from '../../../../../test/http-mock';
import { loadFixture } from '../../../../../test/util';
import { clone } from '../../../../util/clone';
import type { UpdateLockedConfig } from '../../../types';
import { updateLockedDependency } from '.';

const packageFileContent = loadFixture('package.json', './package-lock');
const lockFileContent = loadFixture('package-lock.json', './package-lock');
const acceptsJson = JSON.parse(loadFixture('accepts.json', './package-lock'));
const expressJson = JSON.parse(loadFixture('express.json', './common'));
const mimeJson = JSON.parse(loadFixture('mime.json', './package-lock'));
const serveStaticJson = JSON.parse(
  loadFixture('serve-static.json', './package-lock')
);
const sendJson = JSON.parse(loadFixture('send.json', './package-lock'));
const typeIsJson = JSON.parse(loadFixture('type-is.json', './package-lock'));

describe('manager/npm/update/locked-dependency/index', () => {
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
        await updateLockedDependency({ ...config, lockFile: 'yarn.lock' })
      ).toMatchObject({});
      expect(
        await updateLockedDependency({ ...config, lockFile: 'yarn.lock2' })
      ).toMatchObject({});
    });
    it('validates versions', async () => {
      expect(
        await updateLockedDependency({
          ...config,
          newVersion: '^2.0.0',
        })
      ).toMatchObject({});
    });
    it('returns null for unparseable files', async () => {
      expect(
        await updateLockedDependency({ ...config, lockFileContent: 'not json' })
      ).toMatchObject({});
    });
    it('rejects lockFileVersion 2', async () => {
      expect(
        await updateLockedDependency({
          ...config,
          lockFileContent: lockFileContent.replace(': 1,', ': 2,'),
        })
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
        })
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
        JSON.parse(res.files['package-lock.json']).dependencies.mime.version
      ).toBe('1.2.12');
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
      expect(res.files['package.json']).toContain('"express": "4.1.0"');
      const packageLock = JSON.parse(res.files['package-lock.json']);
      expect(packageLock.dependencies.express.version).toBe('4.1.0');
    });
    it('returns if already remediated', async () => {
      config.depName = 'mime';
      config.currentVersion = '1.2.10';
      config.newVersion = '1.2.11';
      const res = await updateLockedDependency(config);
      expect(res.status).toBe('already-updated');
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
      const packageLock = JSON.parse(res.files['package-lock.json']);
      expect(packageLock.dependencies.mime.version).toBe('1.4.1');
      expect(packageLock.dependencies.express.version).toBe('4.16.0');
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('fails remediation if cannot update parent', async () => {
      config.depName = 'mime';
      config.currentVersion = '1.2.11';
      config.newVersion = '1.4.1';
      config.allowParentUpdates = false;
      const res = await updateLockedDependency(config);
      expect(res.status).toBe('update-failed');
    });
  });
});
