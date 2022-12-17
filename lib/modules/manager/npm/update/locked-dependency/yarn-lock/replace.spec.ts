import * as Diff from 'diff';
import { Fixtures } from '../../../../../../../test/fixtures';
import { replaceConstraintVersion } from './replace';

const yarnLock1 = Fixtures.get('express.yarn.lock');
const yarnLock2 = Fixtures.get('2.yarn.lock');
const yarn2Lock = Fixtures.get('yarn2.lock');

describe('modules/manager/npm/update/locked-dependency/yarn-lock/replace', () => {
  describe('replaceConstraintVersion()', () => {
    it('returns same if Yarn 2+', () => {
      const res = replaceConstraintVersion(
        yarn2Lock,
        'chalk',
        '^2.4.1',
        '2.5.0'
      );
      expect(res).toBe(yarn2Lock);
    });

    it('replaces without dependencies', () => {
      const res = replaceConstraintVersion(
        yarnLock1,
        'fresh',
        '~0.2.1',
        '0.2.5'
      );
      expect(res).not.toEqual(yarnLock1);
      const diffRes = Diff.diffLines(yarnLock1, res);
      const addedSections = diffRes.filter((item) => item.added);
      const removedSections = diffRes.filter((item) => item.removed);
      expect(addedSections).toHaveLength(1);
      expect(removedSections).toHaveLength(1);
      expect(addedSections[0].value).toMatchInlineSnapshot(`
        "  version "0.2.5"
        "
      `);
      expect(removedSections[0].value).toMatchInlineSnapshot(`
        "  version "0.2.4"
          resolved "https://registry.yarnpkg.com/fresh/-/fresh-0.2.4.tgz#3582499206c9723714190edd74b4604feb4a614c"
          integrity sha1-NYJJkgbJcjcUGQ7ddLRgT+tKYUw=
        "
      `);
    });

    it('replaces with dependencies', () => {
      const res = replaceConstraintVersion(
        yarnLock1,
        'express',
        '4.0.0',
        '4.4.0'
      );
      expect(res).not.toEqual(yarnLock1);
      const diffRes = Diff.diffLines(yarnLock1, res);
      const addedSections = diffRes.filter((item) => item.added);
      const removedSections = diffRes.filter((item) => item.removed);
      expect(addedSections).toHaveLength(1);
      expect(removedSections).toHaveLength(1);
      expect(addedSections[0].value).toMatchInlineSnapshot(`
        "  version "4.4.0"
        "
      `);
      expect(removedSections[0].value).toMatchInlineSnapshot(`
        "  version "4.0.0"
          resolved "https://registry.yarnpkg.com/express/-/express-4.0.0.tgz#274dc82933c9f574cc38a0ce5ea8172be9c6b094"
          integrity sha1-J03IKTPJ9XTMOKDOXqgXK+nGsJQ=
        "
      `);
    });

    it('replaces constraint too', () => {
      const res = replaceConstraintVersion(
        yarnLock1,
        'express',
        '4.0.0',
        '4.4.0',
        '4.4.0'
      );
      expect(res).not.toEqual(yarnLock1);
      const diffRes = Diff.diffLines(yarnLock1, res);
      const addedSections = diffRes.filter((item) => item.added);
      const removedSections = diffRes.filter((item) => item.removed);
      expect(addedSections).toHaveLength(1);
      expect(removedSections).toHaveLength(1);
      expect(addedSections[0].value).toMatchInlineSnapshot(`
        "express@4.4.0:
          version "4.4.0"
        "
      `);
      expect(removedSections[0].value).toMatchInlineSnapshot(`
        "express@4.0.0:
          version "4.0.0"
          resolved "https://registry.yarnpkg.com/express/-/express-4.0.0.tgz#274dc82933c9f574cc38a0ce5ea8172be9c6b094"
          integrity sha1-J03IKTPJ9XTMOKDOXqgXK+nGsJQ=
        "
      `);
    });

    it('handles escaped constraints', () => {
      const res = replaceConstraintVersion(
        yarnLock2,
        'string-width',
        '^1.0.1 || ^2.0.0',
        '2.2.0'
      );
      expect(res).not.toEqual(yarnLock2);
      const diffRes = Diff.diffLines(yarnLock2, res);
      const addedSections = diffRes.filter((item) => item.added);
      const removedSections = diffRes.filter((item) => item.removed);
      expect(addedSections).toHaveLength(1);
      expect(removedSections).toHaveLength(1);
      expect(addedSections[0].value).toMatchInlineSnapshot(`
        "  version "2.2.0"
        "
      `);
      expect(removedSections[0].value).toMatchInlineSnapshot(`
        "string-width@^1.0.1:
          version "1.0.2"
          resolved "https://registry.yarnpkg.com/string-width/-/string-width-1.0.2.tgz#118bdf5b8cdc51a2a7e70d211e07e2b0b9b107d3"
          integrity sha1-EYvfW4zcUaKn5w0hHgfisLmxB9M=
        "
      `);
    });

    it('handles quoted', () => {
      const res = replaceConstraintVersion(
        yarnLock2,
        '@embroider/addon-shim',
        '^0.48.0',
        '0.48.1'
      );
      expect(res).not.toEqual(yarnLock2);
      const diffRes = Diff.diffLines(yarnLock2, res);
      const addedSections = diffRes.filter((item) => item.added);
      const removedSections = diffRes.filter((item) => item.removed);
      expect(addedSections).toHaveLength(1);
      expect(removedSections).toHaveLength(1);
      expect(addedSections[0].value).toMatchInlineSnapshot(`
        "  version "0.48.1"
        "
      `);
      expect(removedSections[0].value).toMatchInlineSnapshot(`
        "  version "0.48.0"
          resolved "https://registry.yarnpkg.com/@embroider/addon-shim/-/addon-shim-0.48.0.tgz#2a950ecb82c45ae53e801bcddfd26dc420cac9e8"
          integrity sha512-hu2Yzv5xXHl1vCzkcybjyjCK2/fHwKPDJ5xpwRlvASU/8WMBVLekQQ9Tt8WhPMZJHdMkzIWchAPGkLZaKaeXmA==
        "
      `);
    });
  });
});
