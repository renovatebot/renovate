import { codeBlock } from 'common-tags';
import { Fixtures } from '~test/fixtures.ts';
import { fs } from '~test/util.ts';
import { extractPackageFile } from './index.ts';

vi.mock('../../../util/fs/index.ts');

const requirements1 = Fixtures.get('composer1.json');
const requirements2 = Fixtures.get('composer2.json');
const requirements3 = Fixtures.get('composer3.json');
const requirements4 = Fixtures.get('composer4.json');
const requirements5 = Fixtures.get('composer5.json');
const requirements6 = Fixtures.get('composer6.json');
const requirements5Lock = Fixtures.get('composer5.lock');

describe('modules/manager/composer/extract', () => {
  describe('extractPackageFile()', () => {
    let packageFile: string;

    beforeEach(() => {
      packageFile = 'composer.json';
    });

    it('returns null for invalid json', async () => {
      expect(await extractPackageFile('nothing here', packageFile)).toBeNull();
    });

    it('returns null for empty deps', async () => {
      expect(await extractPackageFile('{}', packageFile)).toBeNull();
    });

    it('extracts dependencies with no lock file', async () => {
      const res = await extractPackageFile(requirements1, packageFile);
      expect(res).toEqual({
        deps: [
          {
            currentValue: '>=5.3.2',
            datasource: 'github-tags',
            depName: 'php',
            depType: 'require',
            packageName: 'containerbase/php-prebuild',
          },
          {
            currentValue: '*',
            datasource: 'packagist',
            depName: 'ext-intl',
            depType: 'require',
            skipReason: 'unsupported',
          },
          {
            currentValue: 'dev-master',
            datasource: 'packagist',
            depName: 'symfony/assetic-bundle',
            depType: 'require',
          },
          {
            currentValue: 'dev-master',
            datasource: 'packagist',
            depName: 'symfony/monolog-bundle',
            depType: 'require',
          },
          {
            currentValue: 'dev-master',
            datasource: 'packagist',
            depName: 'symfony/swiftmailer-bundle',
            depType: 'require',
          },
          {
            currentValue: '2.1.*',
            datasource: 'packagist',
            depName: 'symfony/symfony',
            depType: 'require',
          },
          {
            currentValue: '2.2.2',
            datasource: 'packagist',
            depName: 'doctrine/common',
            depType: 'require',
          },
          {
            currentValue: 'dev-master',
            datasource: 'packagist',
            depName: 'doctrine/doctrine-bundle',
            depType: 'require',
          },
          {
            currentValue: 'dev-master',
            datasource: 'packagist',
            depName: 'doctrine/doctrine-fixtures-bundle',
            depType: 'require',
          },
          {
            currentValue: '2.2.x-dev',
            datasource: 'packagist',
            depName: 'doctrine/orm',
            depType: 'require',
          },
          {
            currentValue: 'dev-master',
            datasource: 'packagist',
            depName: 'exercise/elastica-bundle',
            depType: 'require',
          },
          {
            currentValue: 'dev-master',
            datasource: 'packagist',
            depName: 'friendsofsymfony/rest-bundle',
            depType: 'require',
          },
          {
            currentValue: '*',
            datasource: 'packagist',
            depName: 'friendsofsymfony/user-bundle',
            depType: 'require',
          },
          {
            currentValue: '*',
            datasource: 'packagist',
            depName: 'fzaninotto/faker',
            depType: 'require',
          },
          {
            currentValue: '1.0.1',
            datasource: 'packagist',
            depName: 'jms/di-extra-bundle',
            depType: 'require',
          },
          {
            currentValue: '*',
            datasource: 'packagist',
            depName: 'jms/payment-core-bundle',
            depType: 'require',
          },
          {
            currentValue: '1.1.0',
            datasource: 'packagist',
            depName: 'jms/security-extra-bundle',
            depType: 'require',
          },
          {
            currentValue: 'dev-master',
            datasource: 'packagist',
            depName: 'knplabs/knp-menu-bundle',
            depType: 'require',
          },
          {
            currentValue: 'dev-master',
            datasource: 'packagist',
            depName: 'knplabs/knp-paginator-bundle',
            depType: 'require',
          },
          {
            currentValue: 'dev-master',
            datasource: 'packagist',
            depName: 'liip/imagine-bundle',
            depType: 'require',
          },
          {
            currentValue: 'dev-master',
            datasource: 'packagist',
            depName: 'merk/dough-bundle',
            depType: 'require',
          },
          {
            currentValue: 'dev-master',
            datasource: 'packagist',
            depName: 'sensio/distribution-bundle',
            depType: 'require',
          },
          {
            currentValue: 'dev-master',
            datasource: 'packagist',
            depName: 'sensio/framework-extra-bundle',
            depType: 'require',
          },
          {
            currentValue: 'dev-master',
            datasource: 'packagist',
            depName: 'sensio/generator-bundle',
            depType: 'require',
          },
          {
            currentValue: 'dev-master',
            datasource: 'packagist',
            depName: 'simplethings/entity-audit-bundle',
            depType: 'require',
          },
          {
            currentValue: 'dev-master',
            datasource: 'packagist',
            depName: 'stof/doctrine-extensions-bundle',
            depType: 'require',
          },
          {
            currentValue: 'dev-master',
            datasource: 'packagist',
            depName: 'twig/extensions',
            depType: 'require',
          },
          {
            currentValue: '2.3.*',
            datasource: 'packagist',
            depName: 'behat/behat',
            depType: 'require-dev',
          },
          {
            currentValue: '*',
            datasource: 'packagist',
            depName: 'behat/behat-bundle',
            depType: 'require-dev',
          },
          {
            currentValue: '*',
            datasource: 'packagist',
            depName: 'behat/mink-bundle',
            depType: 'require-dev',
          },
          {
            currentValue: '*',
            datasource: 'packagist',
            depName: 'behat/sahi-client',
            depType: 'require-dev',
          },
          {
            currentValue: '*',
            datasource: 'packagist',
            depName: 'behat/common-contexts',
            depType: 'require-dev',
          },
          {
            currentValue: '^1.10.0',
            datasource: 'packagist',
            depName: 'composer/composer',
            depType: 'require-dev',
          },
        ],
        extractedConstraints: {
          php: '>=5.3.2',
        },
      });
      expect(res?.deps).toHaveLength(33);
    });

    it('extracts registryUrls', async () => {
      const res = await extractPackageFile(requirements2, packageFile);
      expect(res).toEqual({
        deps: [
          {
            currentValue: '*',
            datasource: 'packagist',
            depName: 'aws/aws-sdk-php',
            depType: 'require',
            registryUrls: ['https://wpackagist.org'],
          },
          {
            currentValue: '^1.10.0',
            datasource: 'packagist',
            depName: 'composer/composer',
            depType: 'require',
            registryUrls: ['https://wpackagist.org'],
          },
          {
            currentValue: 'dev-trunk',
            datasource: 'packagist',
            depName: 'wpackagist-plugin/akismet',
            depType: 'require',
            registryUrls: ['https://wpackagist.org'],
          },
          {
            currentValue: '>=7.0.2',
            datasource: 'packagist',
            depName: 'wpackagist-plugin/wordpress-seo',
            depType: 'require',
            registryUrls: ['https://wpackagist.org'],
          },
          {
            currentValue: '*',
            datasource: 'packagist',
            depName: 'wpackagist-theme/hueman',
            depType: 'require',
            registryUrls: ['https://wpackagist.org'],
          },
        ],
      });
    });

    it('extracts object registryUrls', async () => {
      const res = await extractPackageFile(requirements3, packageFile);
      expect(res).toEqual({
        deps: [
          {
            currentValue: '>=5.5',
            datasource: 'github-tags',
            depName: 'php',
            depType: 'require',
            packageName: 'containerbase/php-prebuild',
          },
          {
            currentValue: '~1.0.12',
            datasource: 'packagist',
            depName: 'composer/installers',
            depType: 'require',
            registryUrls: ['https://wpackagist.org'],
          },
          {
            currentValue: '*',
            datasource: 'packagist',
            depName: 'johnpbloch/wordpress',
            depType: 'require',
            registryUrls: ['https://wpackagist.org'],
          },
          {
            currentValue: '^2.0.1',
            datasource: 'packagist',
            depName: 'vlucas/phpdotenv',
            depType: 'require',
            registryUrls: ['https://wpackagist.org'],
          },
          {
            currentValue: '^1.0',
            datasource: 'packagist',
            depName: 'oscarotero/env',
            depType: 'require',
            registryUrls: ['https://wpackagist.org'],
          },
          {
            currentValue: '*',
            datasource: 'packagist',
            depName: 'wpackagist-plugin/tinymce-advanced',
            depType: 'require',
            registryUrls: ['https://wpackagist.org'],
          },
          {
            currentValue: '*',
            datasource: 'packagist',
            depName: 'wpackagist-plugin/acf-content-analysis-for-yoast-seo',
            depType: 'require',
            registryUrls: ['https://wpackagist.org'],
          },
          {
            currentValue: '*',
            datasource: 'packagist',
            depName: 'wpackagist-plugin/duplicate-post',
            depType: 'require',
            registryUrls: ['https://wpackagist.org'],
          },
          {
            currentValue: '*',
            datasource: 'packagist',
            depName: 'wpackagist-plugin/simple-image-sizes',
            depType: 'require',
            registryUrls: ['https://wpackagist.org'],
          },
          {
            currentValue: '*',
            datasource: 'packagist',
            depName: 'wpackagist-plugin/wordpress-seo',
            depType: 'require',
            registryUrls: ['https://wpackagist.org'],
          },
          {
            currentValue: '*',
            datasource: 'packagist',
            depName: 'wpackagist-plugin/timber-library',
            depType: 'require',
            registryUrls: ['https://wpackagist.org'],
          },
          {
            currentValue: '*',
            datasource: 'packagist',
            depName: 'wp-sync-db/wp-sync-db',
            depType: 'require',
            registryUrls: ['https://wpackagist.org'],
          },
          {
            currentValue: '*',
            datasource: 'packagist',
            depName: 'asha23/wp-seed-timber',
            depType: 'require',
            registryUrls: ['https://wpackagist.org'],
          },
        ],
        extractedConstraints: {
          php: '>=5.5',
        },
        managerData: {
          composerJsonType: 'project',
        },
      });
    });

    it('extracts repositories and registryUrls', async () => {
      const res = await extractPackageFile(requirements4, packageFile);
      expect(res).toEqual({
        deps: [
          {
            currentValue: '*',
            datasource: 'packagist',
            depName: 'aws/aws-sdk-php',
            depType: 'require',
            registryUrls: [
              'https://wpackagist.org',
              'https://gitlab.vendor.com/api/v4/group/2/-/packages/composer',
              'https://repo.packagist.org',
            ],
          },
          {
            currentValue: 'dev-trunk',
            datasource: 'git-tags',
            depName: 'awesome/vcs',
            depType: 'require',
            packageName: 'https://my-vcs.example/my-vcs-repo',
          },
          {
            currentValue: '>=7.0.2',
            datasource: 'git-tags',
            depName: 'awesome/git',
            depType: 'require',
            packageName: 'https://my-git.example/my-git-repo',
          },
        ],
      });
    });

    it('extracts bitbucket repositories and registryUrls', async () => {
      const res = await extractPackageFile(requirements6, packageFile);
      expect(res).toEqual({
        deps: [
          {
            currentValue: 'dev-trunk',
            datasource: 'bitbucket-tags',
            depName: 'awesome/bitbucket-repo1',
            depType: 'require',
            packageName: 'awesome/bitbucket-repo1',
          },
          {
            currentValue: 'dev-trunk',
            datasource: 'bitbucket-tags',
            depName: 'awesome/bitbucket-repo2',
            depType: 'require',
            packageName: 'awesome/bitbucket-repo2',
          },
          {
            currentValue: 'dev-trunk',
            datasource: 'bitbucket-tags',
            depName: 'awesome/bitbucket-repo3',
            depType: 'require',
            packageName: 'awesome/bitbucket-repo3',
          },
        ],
      });
    });

    it('extracts object repositories and registryUrls with lock file', async () => {
      fs.readLocalFile.mockResolvedValue(requirements5Lock);
      const res = await extractPackageFile(requirements5, packageFile);
      expect(res).toEqual({
        deps: [
          {
            currentValue: '*',
            datasource: 'packagist',
            depName: 'aws/aws-sdk-php',
            depType: 'require',
            registryUrls: [
              'https://wpackagist.org',
              'https://repo.packagist.org',
            ],
          },
          {
            currentValue: 'dev-trunk',
            datasource: 'git-tags',
            depName: 'awesome/vcs',
            depType: 'require',
            lockedVersion: '1.1.0',
            packageName: 'https://my-vcs.example/my-vcs-repo',
          },
          {
            currentValue: '>=7.0.2',
            datasource: 'git-tags',
            depName: 'awesome/git',
            depType: 'require',
            lockedVersion: '1.2.0',
            packageName: 'git@my-git.example:my-git-repo',
          },
        ],
        lockFiles: ['composer.lock'],
      });
    });

    it('skips path dependencies', async () => {
      const res = await extractPackageFile(
        codeBlock`
          {
            "name": "acme/path-sources",
            "description": "Fetch Packages via path",
            "repositories": {
              "acme/path1": {
                "type": "path",
                "url": "packages/acme/path1"
              }
            },
            "require": {
              "acme/path1": "*"
            }
          }
        `,
        packageFile,
      );
      expect(res?.deps).toEqual([
        {
          currentValue: '*',
          depName: 'acme/path1',
          depType: 'require',
          skipReason: 'path-dependency',
        },
      ]);
    });

    it('extracts dependencies with lock file', async () => {
      fs.readLocalFile.mockResolvedValue('{}');
      const res = await extractPackageFile(requirements1, packageFile);
      expect(res).toEqual({
        deps: [
          {
            currentValue: '>=5.3.2',
            datasource: 'github-tags',
            depName: 'php',
            depType: 'require',
            packageName: 'containerbase/php-prebuild',
          },
          {
            currentValue: '*',
            datasource: 'packagist',
            depName: 'ext-intl',
            depType: 'require',
            skipReason: 'unsupported',
          },
          {
            currentValue: 'dev-master',
            datasource: 'packagist',
            depName: 'symfony/assetic-bundle',
            depType: 'require',
          },
          {
            currentValue: 'dev-master',
            datasource: 'packagist',
            depName: 'symfony/monolog-bundle',
            depType: 'require',
          },
          {
            currentValue: 'dev-master',
            datasource: 'packagist',
            depName: 'symfony/swiftmailer-bundle',
            depType: 'require',
          },
          {
            currentValue: '2.1.*',
            datasource: 'packagist',
            depName: 'symfony/symfony',
            depType: 'require',
          },
          {
            currentValue: '2.2.2',
            datasource: 'packagist',
            depName: 'doctrine/common',
            depType: 'require',
          },
          {
            currentValue: 'dev-master',
            datasource: 'packagist',
            depName: 'doctrine/doctrine-bundle',
            depType: 'require',
          },
          {
            currentValue: 'dev-master',
            datasource: 'packagist',
            depName: 'doctrine/doctrine-fixtures-bundle',
            depType: 'require',
          },
          {
            currentValue: '2.2.x-dev',
            datasource: 'packagist',
            depName: 'doctrine/orm',
            depType: 'require',
          },
          {
            currentValue: 'dev-master',
            datasource: 'packagist',
            depName: 'exercise/elastica-bundle',
            depType: 'require',
          },
          {
            currentValue: 'dev-master',
            datasource: 'packagist',
            depName: 'friendsofsymfony/rest-bundle',
            depType: 'require',
          },
          {
            currentValue: '*',
            datasource: 'packagist',
            depName: 'friendsofsymfony/user-bundle',
            depType: 'require',
          },
          {
            currentValue: '*',
            datasource: 'packagist',
            depName: 'fzaninotto/faker',
            depType: 'require',
          },
          {
            currentValue: '1.0.1',
            datasource: 'packagist',
            depName: 'jms/di-extra-bundle',
            depType: 'require',
          },
          {
            currentValue: '*',
            datasource: 'packagist',
            depName: 'jms/payment-core-bundle',
            depType: 'require',
          },
          {
            currentValue: '1.1.0',
            datasource: 'packagist',
            depName: 'jms/security-extra-bundle',
            depType: 'require',
          },
          {
            currentValue: 'dev-master',
            datasource: 'packagist',
            depName: 'knplabs/knp-menu-bundle',
            depType: 'require',
          },
          {
            currentValue: 'dev-master',
            datasource: 'packagist',
            depName: 'knplabs/knp-paginator-bundle',
            depType: 'require',
          },
          {
            currentValue: 'dev-master',
            datasource: 'packagist',
            depName: 'liip/imagine-bundle',
            depType: 'require',
          },
          {
            currentValue: 'dev-master',
            datasource: 'packagist',
            depName: 'merk/dough-bundle',
            depType: 'require',
          },
          {
            currentValue: 'dev-master',
            datasource: 'packagist',
            depName: 'sensio/distribution-bundle',
            depType: 'require',
          },
          {
            currentValue: 'dev-master',
            datasource: 'packagist',
            depName: 'sensio/framework-extra-bundle',
            depType: 'require',
          },
          {
            currentValue: 'dev-master',
            datasource: 'packagist',
            depName: 'sensio/generator-bundle',
            depType: 'require',
          },
          {
            currentValue: 'dev-master',
            datasource: 'packagist',
            depName: 'simplethings/entity-audit-bundle',
            depType: 'require',
          },
          {
            currentValue: 'dev-master',
            datasource: 'packagist',
            depName: 'stof/doctrine-extensions-bundle',
            depType: 'require',
          },
          {
            currentValue: 'dev-master',
            datasource: 'packagist',
            depName: 'twig/extensions',
            depType: 'require',
          },
          {
            currentValue: '2.3.*',
            datasource: 'packagist',
            depName: 'behat/behat',
            depType: 'require-dev',
          },
          {
            currentValue: '*',
            datasource: 'packagist',
            depName: 'behat/behat-bundle',
            depType: 'require-dev',
          },
          {
            currentValue: '*',
            datasource: 'packagist',
            depName: 'behat/mink-bundle',
            depType: 'require-dev',
          },
          {
            currentValue: '*',
            datasource: 'packagist',
            depName: 'behat/sahi-client',
            depType: 'require-dev',
          },
          {
            currentValue: '*',
            datasource: 'packagist',
            depName: 'behat/common-contexts',
            depType: 'require-dev',
          },
          {
            currentValue: '^1.10.0',
            datasource: 'packagist',
            depName: 'composer/composer',
            depType: 'require-dev',
          },
        ],
        extractedConstraints: {
          php: '>=5.3.2',
        },
        lockFiles: ['composer.lock'],
      });
      expect(res?.deps).toHaveLength(33);
    });
  });
});
