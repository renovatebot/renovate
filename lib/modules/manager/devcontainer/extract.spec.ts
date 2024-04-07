import upath from 'upath';
import * as dockerfileExtract from '../dockerfile/extract';
import { extractPackageFile } from '.';

function getFixture(content: string) {
  return {
    content,
    path: upath.resolve(__dirname, 'devcontainer.json'),
  };
}

describe('modules/manager/devcontainer/extract', () => {
  describe('extractPackageFile()', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('returns null when the dev container JSON file is empty', () => {
      // Arrange
      const content = '';
      const packageFile = '';
      const extractConfig = {};
      // Act
      const result = extractPackageFile(content, packageFile, extractConfig);

      // Assert
      expect(result).toBeNull();
    });

    it('returns null when the dev container JSON file contents are malformed', () => {
      // Arrange
      const content = 'malformed json}}}';
      const packageFile = '';
      const extractConfig = {};
      // Act
      const result = extractPackageFile(content, packageFile, extractConfig);

      // Assert
      expect(result).toBeNull();
    });

    it('returns feature image deps when only the features property is defined in dev container JSON file', () => {
      // Arrange
      const fixture = getFixture(`
      {
        "features": {
          "devcontainer.registry.renovate.com/test/features/first:1.2.3": {},
          "devcontainer.registry.renovate.com/test/features/second:4.5.6": {}
        }
      }`);
      const extractConfig = {};
      // Act
      const result = extractPackageFile(
        fixture.content,
        fixture.path,
        extractConfig,
      );

      // Assert
      expect(result).not.toBeNull();
      expect(result?.deps).not.toBeNull();
      expect(result?.deps.length).toBe(2);
      expect(result?.deps).toMatchInlineSnapshot(`
      [
        {
          "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
          "currentDigest": undefined,
          "currentValue": "1.2.3",
          "datasource": "docker",
          "depName": "devcontainer.registry.renovate.com/test/features/first",
          "replaceString": "devcontainer.registry.renovate.com/test/features/first:1.2.3",
        },
        {
          "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
          "currentDigest": undefined,
          "currentValue": "4.5.6",
          "datasource": "docker",
          "depName": "devcontainer.registry.renovate.com/test/features/second",
          "replaceString": "devcontainer.registry.renovate.com/test/features/second:4.5.6",
        },
      ]
      `);
    });

    it('returns image and feature image deps when both image and features properties are defined in dev container JSON file', () => {
      // Arrange
      const fixture = getFixture(`
      {
        "image": "devcontainer.registry.renovate.com/test/image:1.2.3",
        "features": {
          "devcontainer.registry.renovate.com/test/feature:4.5.6": {}
        }
      }`);
      const extractConfig = {};

      // Act
      const result = extractPackageFile(
        fixture.content,
        fixture.path,
        extractConfig,
      );

      // Assert
      expect(result).not.toBeNull();
      expect(result?.deps).not.toBeNull();
      expect(result?.deps.length).toBe(2);
      expect(result?.deps).toMatchInlineSnapshot(`
      [
        {
          "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
          "currentDigest": undefined,
          "currentValue": "1.2.3",
          "datasource": "docker",
          "depName": "devcontainer.registry.renovate.com/test/image",
          "replaceString": "devcontainer.registry.renovate.com/test/image:1.2.3",
        },
        {
          "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
          "currentDigest": undefined,
          "currentValue": "4.5.6",
          "datasource": "docker",
          "depName": "devcontainer.registry.renovate.com/test/feature",
          "replaceString": "devcontainer.registry.renovate.com/test/feature:4.5.6",
        },
      ]
      `);
    });

    it('returns image dep when only the image property is defined in dev container JSON file', () => {
      // Arrange
      const fixture = getFixture(`
      {
        "image": "devcontainer.registry.renovate.com/test/image:1.2.3"
      }`);
      const extractConfig = {};
      // Act
      const result = extractPackageFile(
        fixture.content,
        fixture.path,
        extractConfig,
      );

      // Assert
      expect(result).not.toBeNull();
      expect(result?.deps).not.toBeNull();
      expect(result?.deps.length).toBe(1);
      expect(result?.deps).toMatchInlineSnapshot(`
      [
        {
          "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
          "currentDigest": undefined,
          "currentValue": "1.2.3",
          "datasource": "docker",
          "depName": "devcontainer.registry.renovate.com/test/image",
          "replaceString": "devcontainer.registry.renovate.com/test/image:1.2.3",
        },
      ]
      `);
    });

    it('returns null when the only feature property is malformed and no image property is defined in dev container JSON file', () => {
      // Arrange
      const fixture = getFixture(`
      {
        "features": {
          "malformedFeature": {}
        }
      }`);
      const extractConfig = {};
      // Act
      const result = extractPackageFile(
        fixture.content,
        fixture.path,
        extractConfig,
      );

      // Assert
      expect(result).toBeNull();
    });

    it('returns null when the features property is malformed and no image property is defined in dev container JSON file', () => {
      // Arrange
      const fixture = getFixture(`
      {
        "features": "devcontainer.registry.renovate.com/test:1.2.3"
      }`);
      const extractConfig = {};
      // Act
      const result = extractPackageFile(
        fixture.content,
        fixture.path,
        extractConfig,
      );

      // Assert
      expect(result).toBeNull();
    });

    it('returns null when the image property is malformed and no features are defined in dev container JSON file', () => {
      // Arrange
      const fixture = getFixture(`
      {
        "image:": "devcontainer.registry.renovate.com/test/image:1.2.3"
      }`);
      const extractConfig = {};
      // Act
      const result = extractPackageFile(
        fixture.content,
        fixture.path,
        extractConfig,
      );

      // Assert
      expect(result).toBeNull();
    });

    it('returns null when no image or features properties are defined in dev container JSON file', () => {
      // Arrange
      const fixture = getFixture('{}');
      const extractConfig = {};
      // Act
      const result = extractPackageFile(
        fixture.content,
        fixture.path,
        extractConfig,
      );

      // Assert
      expect(result).toBeNull();
    });

    it('returns null when the features property is null and no image property is defined in dev container JSON file', () => {
      // Arrange
      const fixture = getFixture(`
      {
        "features": null
      }`);
      const extractConfig = {};
      // Act
      const result = extractPackageFile(
        fixture.content,
        fixture.path,
        extractConfig,
      );

      // Assert
      expect(result).toBeNull();
    });

    it('returns null when the features property is not defined and the image property is null in dev container JSON file', () => {
      // Arrange
      const fixture = getFixture(`
      {
        "image": null
      }`);
      const extractConfig = {};
      // Act
      const result = extractPackageFile(
        fixture.content,
        fixture.path,
        extractConfig,
      );

      // Assert
      expect(result).toBeNull();
    });

    it('returns null when both the image and features properties are null', () => {
      // Arrange
      const fixture = getFixture(`
      {
        "image": null,
        "features": null
      }`);
      const extractConfig = {};
      // Act
      const result = extractPackageFile(
        fixture.content,
        fixture.path,
        extractConfig,
      );

      // Assert
      expect(result).toBeNull();
    });

    it('returns only valid dependencies when others throw error when calling getDep', () => {
      // Arrange
      const fixture = getFixture(`
      {
        "image": "devcontainer.registry.renovate.com/test/image:1.2.3",
        "features": {
          "devcontainer.registry.renovate.com/test/feature:4.5.6": {}
        }
      }`);
      const extractConfig = {};
      jest.spyOn(dockerfileExtract, 'getDep').mockImplementationOnce(() => {
        throw new Error('Dependency error');
      });

      // Act
      const result = extractPackageFile(
        fixture.content,
        fixture.path,
        extractConfig,
      );

      // Assert
      expect(result).not.toBeNull();
      expect(result?.deps).not.toBeNull();
      expect(result?.deps.length).toBe(1);
      expect(result?.deps).toMatchInlineSnapshot(`
      [
        {
          "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
          "currentDigest": undefined,
          "currentValue": "4.5.6",
          "datasource": "docker",
          "depName": "devcontainer.registry.renovate.com/test/feature",
          "replaceString": "devcontainer.registry.renovate.com/test/feature:4.5.6",
        },
      ]
      `);
    });

    it('returns only docker dependencies when non-docker feature types are defined beneath the features property in dev container JSON file', () => {
      // Arrange
      const fixture = getFixture(`
      {
        "features": {
          "devcontainer.registry.renovate.com/test/feature:1.2.3": {},
          "./localfeature": {},
          "devcontainer.registry.renovate.com/test/feature/other.tgz": {}
        }
      }`);
      const extractConfig = {};

      // Act
      const result = extractPackageFile(
        fixture.content,
        fixture.path,
        extractConfig,
      );

      // Assert
      expect(result).not.toBeNull();
      expect(result?.deps).not.toBeNull();
      expect(result?.deps.length).toBe(1);
      expect(result?.deps).toMatchInlineSnapshot(`
      [
        {
          "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
          "currentDigest": undefined,
          "currentValue": "1.2.3",
          "datasource": "docker",
          "depName": "devcontainer.registry.renovate.com/test/feature",
          "replaceString": "devcontainer.registry.renovate.com/test/feature:1.2.3",
        },
      ]
      `);
    });
  });
});
