import { parseSyml } from '@yarnpkg/parsers';
import { Fixtures } from '../../../../../../../test/fixtures';
import { getLockedDependencies } from './get-locked';

const yarnLock1 = parseSyml(Fixtures.get('express.yarn.lock'));
const yarnLock3 = parseSyml(Fixtures.get('3.yarn.lock'));

describe('modules/manager/npm/update/locked-dependency/yarn-lock/get-locked', () => {
  describe('replaceConstraintVersion()', () => {
    it('finds unscoped', () => {
      expect(getLockedDependencies(yarnLock1, 'cookie', '0.1.0'))
        .toMatchInlineSnapshot(`
        [
          {
            "constraint": "0.1.0",
            "depName": "cookie",
            "depNameConstraint": "cookie@0.1.0",
            "entry": {
              "integrity": "sha1-kOtGndzpBchm3mh+/EMTHYgB+dA=",
              "resolved": "https://registry.yarnpkg.com/cookie/-/cookie-0.1.0.tgz#90eb469ddce905c866de687efc43131d8801f9d0",
              "version": "0.1.0",
            },
          },
        ]
      `);
    });

    it('finds scoped', () => {
      expect(getLockedDependencies(yarnLock3, '@actions/core', '1.2.6'))
        .toMatchInlineSnapshot(`
        [
          {
            "constraint": "^1.2.6",
            "depName": "@actions/core",
            "depNameConstraint": "@actions/core@npm:^1.2.6",
            "entry": {
              "checksum": "034e57fcb5f944d5fb0ef55be1b212dd88e23d1a50aaffda874cb94e8f4bfa633a66f108f26e81a7cce287cd2b349aa88c97d2023135c8879495326db37a7feb",
              "languageName": "node",
              "linkType": "hard",
              "resolution": "@actions/core@npm:1.2.6",
              "version": "1.2.6",
            },
          },
        ]
      `);
    });
  });
});
