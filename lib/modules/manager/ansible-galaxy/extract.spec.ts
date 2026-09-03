import { codeBlock } from 'common-tags';
import { Fixtures } from '~test/fixtures.ts';
import { getSliceEndNumber } from './extract.ts';
import { extractPackageFile } from './index.ts';

const yamlFile1 = Fixtures.get('requirements01.yml');
const yamlFile2 = Fixtures.get('requirements02.yml');
const helmRequirements = Fixtures.get('helmRequirements.yml');
const collections1 = Fixtures.get('collections1.yml');
const collections2 = Fixtures.get('collections2.yml');
const galaxy = Fixtures.get('galaxy.yml');

describe('modules/manager/ansible-galaxy/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here', 'requirements.yml')).toBeNull();
    });

    it('extracts multiple dependencies from requirements.yml', () => {
      const res = extractPackageFile(yamlFile1, 'requirements.yml');
      expect(res?.deps).toMatchObject([
        {
          depName: 'yatesr.timezone',
          currentValue: '0.1.0',
          datasource: 'galaxy',
        },
        {
          depName: 'cloudalchemy.node-exporter',
          currentValue: '0.19.0',
          datasource: 'galaxy',
        },
        {
          depName: 'nginx_role',
          currentValue: 'master',
          datasource: 'git-tags',
          packageName: 'https://github.com/bennojoy/nginx',
        },
        {
          depName: 'willthames/git-ansible-galaxy',
          currentValue: 'v1.4',
          datasource: 'git-tags',
          packageName: 'http://bitbucket.org/willthames/git-ansible-galaxy',
        },
        {
          depName: 'mygroup/ansible-base',
          currentValue: '0.1',
          datasource: 'git-tags',
          packageName: 'git@gitlab.company.com:mygroup/ansible-base.git',
        },
        {
          depName: 'testGroup/testProject',
          currentValue: '0.1',
          datasource: 'git-tags',
          packageName: 'ssh://git@gitlab.company.com/testGroup/testProject.git',
        },
        {
          depName: 'testGroup/testProject2',
          currentValue: '0.1',
          datasource: 'git-tags',
          packageName: 'ssh://gitlab.company.com/testGroup/testProject2.git',
        },
        {
          depName: 'testGroup/testProject3',
          currentValue: '3.1',
          datasource: 'git-tags',
          packageName:
            'ssh://git@gitlab.company.com:23/testGroup/testProject3.git',
        },
        {
          depName: 'mygroup/ansible-base',
          currentValue: '0.14',
          datasource: 'git-tags',
          packageName: 'git@gitlab.company.com:mygroup/ansible-base.git',
        },
        {
          depName: 'mygroup/ansible-base',
          currentValue: '0.14',
          datasource: 'git-tags',
          packageName: 'company.com:mygroup/ansible-base.git',
        },
        {
          depName: 'org/repo',
          currentValue: '47.11',
          datasource: 'git-tags',
          packageName: 'git://github.com/org/repo.git',
        },
        {
          depName: 'org/re.po',
          currentValue: '47.11',
          datasource: 'git-tags',
          packageName: 'git://github.com/org/re.po.git',
        },
      ]);
      expect(res?.deps).toHaveLength(12);
    });

    it('extracts dependencies from a not beautified requirements file', () => {
      const res = extractPackageFile(yamlFile2, 'requirements.yml');
      expect(res?.deps).toEqual([
        {
          currentValue: '0.1.0',
          datasource: 'galaxy',
          depName: 'yatesr.timezone',
          depType: 'role',
          packageName: 'yatesr.timezone',
        },
        {
          currentValue: '0.1',
          datasource: 'git-tags',
          depName: 'mygroup/ansible-base',
          depType: 'role',
          packageName: 'git@gitlab.company.com:mygroup/ansible-base.git',
        },
      ]);
      expect(res?.deps).toHaveLength(2);
    });

    it('extracts dependencies from requirements.yml with a space at the end of line', () => {
      const yamlFile = codeBlock`collections:
      - name: https://github.com/lowlydba/lowlydba.sqlserver.git
      type: git
      version: 1.1.3`;
      const res = extractPackageFile(yamlFile, 'requirements.yml');
      expect(res?.deps).toHaveLength(1);
      expect(res?.deps[0].currentValue).toBe('1.1.3');
    });

    it('extracts git@ dependencies', () => {
      const yamlFile = codeBlock`collections:
      - name: community.docker
        source: git@github.com:ansible-collections/community.docker
        type: git
        version: 2.7.5`;
      const res = extractPackageFile(yamlFile, 'requirements.yml');
      expect(res?.deps).toHaveLength(1);
      expect(res?.deps[0].currentValue).toBe('2.7.5');
      expect(res?.deps[0].registryUrls).toBeUndefined();
      expect(res?.deps[0].packageName).toBe(
        'git@github.com:ansible-collections/community.docker',
      );
    });

    it('check if an empty file returns null', () => {
      const res = extractPackageFile('\n', 'requirements.yml');
      expect(res).toBeNull();
    });

    it('check if a requirements file of other systems returns null', () => {
      const res = extractPackageFile(helmRequirements, 'requirements.yml');
      expect(res).toBeNull();
    });

    it('check collection style requirements file', () => {
      const res = extractPackageFile(collections1, 'requirements.yml');
      expect(res?.deps).toMatchObject([
        {
          depName: 'geerlingguy.php_roles',
          depType: 'galaxy-collection',
          currentValue: '0.9.3',
          datasource: 'galaxy-collection',
          registryUrls: ['https://galaxy.ansible.com'],
        },
        {
          depName: 'davidban77.gns3',
          depType: 'galaxy-collection',
          currentValue: '1.2.2',
          datasource: 'galaxy-collection',
        },
        {
          depName: 'github.com/organization/repo_name',
          depType: 'galaxy-collection',
          currentValue: '1.2.2',
          datasource: 'github-tags',
          packageName: 'https://github.com/organization/repo_name.git',
        },
        {
          depName: 'example.com/organization/repo_name',
          depType: 'galaxy-collection',
          currentValue: '1.2.2',
          datasource: 'git-tags',
          packageName: 'https://example.com/organization/repo_name.git',
        },
        {
          depName: 'namespace.mycollection',
          depType: 'galaxy-collection',
          currentValue: '3.0.0',
          datasource: 'git-tags',
          packageName: 'https://example.com/organization/repo_name.git',
        },
        {
          depName: 'example.com/organization/repo_name',
          depType: 'galaxy-collection',
          currentValue: '1.2.2',
          datasource: 'git-tags',
          packageName: 'https://example.com/organization/repo_name.git',
        },
        {
          depName: 'f5networks.f5_modules',
          depType: 'galaxy-collection',
          datasource: 'galaxy-collection',
          registryUrls: ['https://cloud.redhat.com/api/automation-hub/'],
          skipReason: 'unspecified-version',
        },
        {
          depName: 'foo.bar/organization/repo_name',
          depType: 'galaxy-collection',
          datasource: 'git-tags',
          packageName: 'https://foo.bar/organization/repo_name.git',
          skipReason: 'unspecified-version',
        },
        {
          depName: 'fooBar',
          depType: 'galaxy-collection',
          currentValue: '1.0.0',
          skipReason: 'no-source-match',
        },
        {
          depName: 'foo.Bar',
          depType: 'galaxy-collection',
          skipReason: 'unsupported',
        },
        {
          depName: 'foo.Bar',
          depType: 'galaxy-collection',
          skipReason: 'local-dependency',
        },
        {
          depName: 'example.com/organization/repo_name',
          depType: 'galaxy-collection',
          currentValue: '1.2.2',
          skipReason: 'unsupported',
        },
        { depName: 'geerlingguy.java', depType: 'role', currentValue: '1.9.6' },
        {
          depName: 'geerlingguy.docker',
          depType: 'role',
          currentValue: '2.9.0',
        },
      ]);
      expect(res?.deps).toHaveLength(14);
      expect(res?.deps.filter((value) => value.skipReason)).toHaveLength(6);
    });

    it('check collection style requirements file in reverse order and missing empty line', () => {
      const res = extractPackageFile(collections2, 'requirements.yml');
      expect(res?.deps).toMatchObject([
        {
          depName: 'geerlingguy.php_roles',
          depType: 'galaxy-collection',
          currentValue: '0.9.3',
        },
        {
          depName: 'davidban77.gns3',
          depType: 'galaxy-collection',
          currentValue: '1.2.2',
        },
        { depName: 'geerlingguy.java', depType: 'role', currentValue: '1.9.6' },
        {
          depName: 'geerlingguy.docker',
          depType: 'role',
          currentValue: '2.9.0',
        },
      ]);
      expect(res?.deps).toHaveLength(4);
    });

    it('check galaxy definition file', () => {
      const res = extractPackageFile(galaxy, 'galaxy.yml');
      expect(res?.deps).toMatchObject([
        { depName: 'ansible.posix', currentValue: '1.5.4' },
        { depName: 'ansible.posix_with_comment', currentValue: '1.5.4' },
        { depName: 'ansible.windows', currentValue: '1.4.0' },
        { depName: 'ansible.windows_with_comment', currentValue: '1.4.0' },
        { depName: 'community.general', currentValue: '7.3.0' },
        { depName: 'community.general_with_comment', currentValue: '7.3.0' },
        { depName: 'community.windows', currentValue: '>=1.0.0,<2.0.0' },
        { depName: 'community.general_quoted', currentValue: '7.3.0' },
        {
          depName: 'community.general_with_comment_quoted',
          currentValue: '7.3.0',
        },
        { depName: 'community.windows_quoted', currentValue: '>=1.0.0,<2.0.0' },
      ]);
      expect(res?.deps).toHaveLength(10);
    });
  });

  describe('getSliceEndNumber()', () => {
    it('negative start number returns -1', () => {
      const res = getSliceEndNumber(-1, 10, 5);
      expect(res).toBe(-1);
    });

    it('a start number bigger then number of lines return -1', () => {
      const res = getSliceEndNumber(20, 10, 5);
      expect(res).toBe(-1);
    });

    it('choose first block', () => {
      const res = getSliceEndNumber(0, 10, 5);
      expect(res).toBe(5);
    });

    it('choose second block', () => {
      const res = getSliceEndNumber(5, 10, 5);
      expect(res).toBe(10);
    });
  });
});
