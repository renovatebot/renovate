import { codeBlock } from 'common-tags';
import { Json, Json5, Jsonc, MultidocYaml, Toml, Yaml } from './v4';

describe('util/schema-utils/v4', () => {
  describe('Json', () => {
    it('parses valid JSON', () => {
      const input = codeBlock`
        {
          "name": "test",
          "version": "1.0.0",
          "dependencies": {
            "lodash": "^4.17.21"
          }
        }
      `;
      const result = Json.safeParse(input);
      expect(result).toMatchObject({
        success: true,
        data: {
          name: 'test',
          version: '1.0.0',
          dependencies: {
            lodash: '^4.17.21',
          },
        },
      });
    });

    it('fails for invalid JSON', () => {
      const input = codeBlock`
        {
          "name": "test",
          "version": "1.0.0"
          "dependencies": {
            "lodash": "^4.17.21"
          }
        }
      `;
      const result = Json.safeParse(input);
      expect(result).toMatchObject({
        success: false,
        error: {
          issues: [{ message: 'Invalid JSON' }],
        },
      });
    });
  });

  describe('Json5', () => {
    it('parses valid JSON5', () => {
      const input = codeBlock`
        {
          name: 'test',
          version: '1.0.0',
          // This is a comment
          dependencies: {
            lodash: '^4.17.21',
          }
        }
      `;
      const result = Json5.safeParse(input);
      expect(result).toMatchObject({
        success: true,
        data: {
          name: 'test',
          version: '1.0.0',
          dependencies: {
            lodash: '^4.17.21',
          },
        },
      });
    });

    it('fails for invalid JSON5', () => {
      const input = codeBlock`
        {
          name: 'test'
          version: 'invalid
          dependencies: {
            lodash: '^4.17.21'
          }
        }
      `;
      const result = Json5.safeParse(input);
      expect(result).toMatchObject({
        success: false,
        error: {
          issues: [{ message: 'Invalid JSON5' }],
        },
      });
    });
  });

  describe('Jsonc', () => {
    it('parses valid JSONC', () => {
      const input = codeBlock`
        {
          "name": "test",
          "version": "1.0.0",
          // This is a comment
          "dependencies": {
            "lodash": "^4.17.21"
          }
        }
      `;
      const result = Jsonc.safeParse(input);
      expect(result).toMatchObject({
        success: true,
        data: {
          name: 'test',
          version: '1.0.0',
          dependencies: {
            lodash: '^4.17.21',
          },
        },
      });
    });

    it('fails for invalid JSONC', () => {
      const input = codeBlock`
        {
          "name": "test"
          "version": "1.0.0"
          "dependencies": {
            "lodash": "^4.17.21"
          }
        }
      `;
      const result = Jsonc.safeParse(input);
      expect(result).toMatchObject({
        success: false,
        error: {
          issues: [{ message: 'Invalid JSONC' }],
        },
      });
    });
  });

  describe('Yaml', () => {
    it('parses valid YAML', () => {
      const input = codeBlock`
        name: test
        version: 1.0.0
        dependencies:
          lodash: ^4.17.21
          express: ^4.18.0
      `;
      const result = Yaml.safeParse(input);
      expect(result).toMatchObject({
        success: true,
        data: {
          name: 'test',
          version: '1.0.0',
          dependencies: {
            lodash: '^4.17.21',
            express: '^4.18.0',
          },
        },
      });
    });

    it('fails for invalid YAML', () => {
      const input = codeBlock`
        name: test
        version: 1.0.0
        dependencies:
          lodash: ^4.17.21
            invalid: indentation
      `;
      const result = Yaml.safeParse(input);
      expect(result).toMatchObject({
        success: false,
        error: {
          issues: [{ message: 'Invalid YAML' }],
        },
      });
    });
  });

  describe('MultidocYaml', () => {
    it('parses valid multidoc YAML', () => {
      const input = codeBlock`
        ---
        name: test1
        version: 1.0.0
        ---
        name: test2
        version: 2.0.0
      `;
      const result = MultidocYaml.safeParse(input);
      expect(result).toMatchObject({
        success: true,
        data: [
          {
            name: 'test1',
            version: '1.0.0',
          },
          {
            name: 'test2',
            version: '2.0.0',
          },
        ],
      });
    });

    it('fails for invalid multidoc YAML', () => {
      const input = codeBlock`
        ---
        name: test1
        version: 1.0.0
        ---
        name: test2
          invalid: indentation
      `;
      const result = MultidocYaml.safeParse(input);
      expect(result).toMatchObject({
        success: false,
        error: {
          issues: [{ message: 'Invalid YAML' }],
        },
      });
    });
  });

  describe('Toml', () => {
    it('parses valid TOML', () => {
      const input = codeBlock`
        name = "test"
        version = "1.0.0"

        [dependencies]
        lodash = "^4.17.21"
        express = "^4.18.0"
      `;
      const result = Toml.safeParse(input);
      expect(result).toMatchObject({
        success: true,
        data: {
          name: 'test',
          version: '1.0.0',
          dependencies: {
            lodash: '^4.17.21',
            express: '^4.18.0',
          },
        },
      });
    });

    it('fails for invalid TOML', () => {
      const input = codeBlock`
        name = "test"
        version = "1.0.0"
        invalid toml syntax here
        [dependencies]
        lodash = "^4.17.21"
      `;
      const result = Toml.safeParse(input);
      expect(result).toMatchObject({
        success: false,
        error: {
          issues: [{ message: 'Invalid TOML' }],
        },
      });
    });
  });
});
