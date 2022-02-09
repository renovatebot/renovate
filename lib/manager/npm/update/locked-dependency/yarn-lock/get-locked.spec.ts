import { parseSyml } from '@yarnpkg/parsers';
import { loadFixture } from '../../../../../../test/util';
import { getLockedDependencies } from './get-locked';

const yarnLock1 = parseSyml(loadFixture('express.yarn.lock'));
const yarnLock3 = parseSyml(loadFixture('3.yarn.lock'));

describe('manager/npm/update/locked-dependency/yarn-lock/get-locked', () => {
  describe('replaceConstraintVersion()', () => {
    it('finds unscoped', () => {
      expect(getLockedDependencies(yarnLock1, 'cookie', '0.1.0'))
        .toMatchInlineSnapshot(`
        Array [
          Object {
            "constraint": "0.1.0",
            "depName": "cookie",
            "depNameConstraint": "cookie@0.1.0",
            "entry": Object {
              "integrity": "sha1-kOtGndzpBchm3mh+/EMTHYgB+dA=",
              "resolved": "https://registry.yarnpkg.com/cookie/-/cookie-0.1.0.tgz#90eb469ddce905c866de687efc43131d8801f9d0",
              "version": "0.1.0",
            },
          },
        ]
      `);
    });
    it('finds scoped', () => {
      expect(getLockedDependencies(yarnLock3, '@actions/core', '1.6.0'))
        .toMatchInlineSnapshot(`
        Array [
          Object {
            "constraint": "1.6.0",
            "depName": "@actions/core",
            "depNameConstraint": "@actions/core@1.6.0",
            "entry": Object {
              "dependencies": Object {
                "@actions/http-client": "^1.0.11",
              },
              "integrity": "sha512-NB1UAZomZlCV/LmJqkLhNTqtKfFXJZAUPcfl/zqG7EfsQdeUJtaWO98SGbuQ3pydJ3fHl2CvI/51OKYlCYYcaw==",
              "resolved": "https://registry.yarnpkg.com/@actions/core/-/core-1.6.0.tgz#0568e47039bfb6a9170393a73f3b7eb3b22462cb",
              "version": "1.6.0",
            },
          },
          Object {
            "constraint": "^1.2.0",
            "depName": "@actions/core",
            "depNameConstraint": "@actions/core@^1.2.0",
            "entry": Object {
              "dependencies": Object {
                "@actions/http-client": "^1.0.11",
              },
              "integrity": "sha512-NB1UAZomZlCV/LmJqkLhNTqtKfFXJZAUPcfl/zqG7EfsQdeUJtaWO98SGbuQ3pydJ3fHl2CvI/51OKYlCYYcaw==",
              "resolved": "https://registry.yarnpkg.com/@actions/core/-/core-1.6.0.tgz#0568e47039bfb6a9170393a73f3b7eb3b22462cb",
              "version": "1.6.0",
            },
          },
          Object {
            "constraint": "^1.2.6",
            "depName": "@actions/core",
            "depNameConstraint": "@actions/core@^1.2.6",
            "entry": Object {
              "dependencies": Object {
                "@actions/http-client": "^1.0.11",
              },
              "integrity": "sha512-NB1UAZomZlCV/LmJqkLhNTqtKfFXJZAUPcfl/zqG7EfsQdeUJtaWO98SGbuQ3pydJ3fHl2CvI/51OKYlCYYcaw==",
              "resolved": "https://registry.yarnpkg.com/@actions/core/-/core-1.6.0.tgz#0568e47039bfb6a9170393a73f3b7eb3b22462cb",
              "version": "1.6.0",
            },
          },
        ]
      `);
    });
  });
});
