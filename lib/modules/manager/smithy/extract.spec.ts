import { codeBlock } from 'common-tags';
import { extractPackageFile } from './index.ts';

const packageFile = 'smithy-build.json';

describe('modules/manager/smithy/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty content', () => {
      expect(extractPackageFile('', packageFile)).toBeNull();
    });

    it('returns null for malformed JSON', () => {
      expect(extractPackageFile('malformed json}}}', packageFile)).toBeNull();
    });

    it('returns null when maven is not an object', () => {
      const content = codeBlock`
        {
          "version": "1.0",
          "maven": "invalid"
        }
      `;

      expect(extractPackageFile(content, packageFile)).toBeNull();
    });

    it('returns null when dependencies is not an array', () => {
      const content = codeBlock`
        {
          "version": "1.0",
          "maven": {
            "dependencies": "software.amazon.smithy:smithy-aws-traits:1.37.0"
          }
        }
      `;

      expect(extractPackageFile(content, packageFile)).toBeNull();
    });

    it('returns null when there is no maven section', () => {
      const content = codeBlock`
        {
          "version": "1.0",
          "sources": ["model"]
        }
      `;

      expect(extractPackageFile(content, packageFile)).toBeNull();
    });

    it('returns null when only repositories are defined', () => {
      const content = codeBlock`
        {
          "version": "1.0",
          "maven": {
            "repositories": [{ "url": "https://repo.example.com/maven" }]
          }
        }
      `;

      expect(extractPackageFile(content, packageFile)).toBeNull();
    });

    it('returns null for an empty dependencies array', () => {
      const content = codeBlock`
        {
          "version": "1.0",
          "maven": {
            "dependencies": []
          }
        }
      `;

      expect(extractPackageFile(content, packageFile)).toBeNull();
    });

    it('extracts dependencies from a file with comments', () => {
      const content = codeBlock`
        {
          "version": "1.0",
          "maven": {
            // dependencies used for code generation
            "dependencies": [
              "software.amazon.smithy:smithy-aws-traits:1.37.0"
            ]
          }
        }
      `;

      expect(extractPackageFile(content, packageFile)).toEqual({
        deps: [
          {
            depName: 'software.amazon.smithy:smithy-aws-traits',
            currentValue: '1.37.0',
            datasource: 'maven',
          },
        ],
      });
    });

    it('extracts multiple dependencies including version ranges', () => {
      const content = codeBlock`
        {
          "version": "1.0",
          "maven": {
            "dependencies": [
              "software.amazon.smithy:smithy-aws-traits:1.37.0",
              "software.amazon.smithy:smithy-model:[1.0,2.0)"
            ]
          }
        }
      `;

      expect(extractPackageFile(content, packageFile)).toEqual({
        deps: [
          {
            depName: 'software.amazon.smithy:smithy-aws-traits',
            currentValue: '1.37.0',
            datasource: 'maven',
          },
          {
            depName: 'software.amazon.smithy:smithy-model',
            currentValue: '[1.0,2.0)',
            datasource: 'maven',
          },
        ],
      });
    });

    it('skips dependencies with variables or invalid coordinates', () => {
      const content = codeBlock`
        {
          "version": "1.0",
          "maven": {
            "dependencies": [
              "software.amazon.smithy:smithy-aws-traits:\${SMITHY_VERSION}",
              "\${GROUP_ID}:smithy-model:1.0.0",
              "software.amazon.smithy:smithy-cli",
              "software.amazon.smithy:smithy-build:",
              "single",
              "group:artifact:1.0.0:classifier",
              ":artifact:1.0.0",
              "group::1.0.0"
            ]
          }
        }
      `;

      expect(extractPackageFile(content, packageFile)).toEqual({
        deps: [
          {
            depName: 'software.amazon.smithy:smithy-aws-traits',
            datasource: 'maven',
            skipReason: 'contains-variable',
          },
          {
            depName: '${GROUP_ID}:smithy-model:1.0.0',
            skipReason: 'contains-variable',
          },
          {
            depName: 'software.amazon.smithy:smithy-cli',
            datasource: 'maven',
            skipReason: 'unspecified-version',
          },
          {
            depName: 'software.amazon.smithy:smithy-build',
            datasource: 'maven',
            skipReason: 'unspecified-version',
          },
          {
            depName: 'single',
            skipReason: 'invalid-dependency-specification',
          },
          {
            depName: 'group:artifact:1.0.0:classifier',
            skipReason: 'invalid-dependency-specification',
          },
          {
            depName: ':artifact:1.0.0',
            skipReason: 'invalid-dependency-specification',
          },
          {
            depName: 'group::1.0.0',
            skipReason: 'invalid-dependency-specification',
          },
        ],
      });
    });

    it('drops non-string dependency entries', () => {
      const content = codeBlock`
        {
          "version": "1.0",
          "maven": {
            "dependencies": [
              42,
              {},
              "software.amazon.smithy:smithy-aws-traits:1.37.0"
            ]
          }
        }
      `;

      expect(extractPackageFile(content, packageFile)).toEqual({
        deps: [
          {
            depName: 'software.amazon.smithy:smithy-aws-traits',
            currentValue: '1.37.0',
            datasource: 'maven',
          },
        ],
      });
    });

    it('extracts registry urls from repositories', () => {
      const content = codeBlock`
        {
          "version": "1.0",
          "maven": {
            "dependencies": [
              "software.amazon.smithy:smithy-aws-traits:1.37.0"
            ],
            "repositories": [
              { "url": "https://repo.example.com/maven" },
              {
                "url": "https://other.example.com/maven",
                "httpCredentials": "user:\${PASSWORD}"
              },
              { "id": "no-url" },
              { "url": "https://\${PRIVATE_HOST}/maven" }
            ]
          }
        }
      `;

      expect(extractPackageFile(content, packageFile)).toEqual({
        deps: [
          {
            depName: 'software.amazon.smithy:smithy-aws-traits',
            currentValue: '1.37.0',
            datasource: 'maven',
          },
        ],
        registryUrls: [
          'https://repo.example.com/maven',
          'https://other.example.com/maven',
        ],
      });
    });

    it('omits registry urls when all repository urls contain variables', () => {
      const content = codeBlock`
        {
          "version": "1.0",
          "maven": {
            "dependencies": [
              "software.amazon.smithy:smithy-aws-traits:1.37.0"
            ],
            "repositories": [
              { "url": "https://\${PRIVATE_HOST}/maven" }
            ]
          }
        }
      `;

      expect(extractPackageFile(content, packageFile)).toEqual({
        deps: [
          {
            depName: 'software.amazon.smithy:smithy-aws-traits',
            currentValue: '1.37.0',
            datasource: 'maven',
          },
        ],
      });
    });
  });
});
