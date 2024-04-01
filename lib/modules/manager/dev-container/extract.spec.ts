import upath from 'upath';
import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from './extract';

function getFixture(devContainerJsonFixtureFileName: string) {
  return {
    content: Fixtures.get(devContainerJsonFixtureFileName),
    path: upath.resolve(
      __dirname,
      '__fixtures__',
      devContainerJsonFixtureFileName,
    ),
  };
}

const fixtures = {
  featuresOnly: getFixture('.devcontainer.featuresonly.json'),
  imageAndFeature: getFixture('.devcontainer.imageandfeature.json'),
  imageOnly: getFixture('.devcontainer.imageonly.json'),
  malformedFeature: getFixture('.devcontainer.malformedfeature.json'),
  malformedFeatures: getFixture('.devcontainer.malformedfeatures.json'),
  malformedImage: getFixture('.devcontainer.malformedimage.json'),
  noImageOrFeatures: getFixture('.devcontainer.noimageorfeatures.json'),
  nullFeatures: getFixture('.devcontainer.nullfeatures.json'),
  nullImage: getFixture('.devcontainer.nullimage.json'),
  nullImageAndFeatures: getFixture('.devcontainer.nullimageandfeatures.json'),
};

describe('modules/manager/dev-container/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null when file is empty', () => {
      // Arrange
      const content = '';
      const packageFile = '';
      const extractConfig = {};
      // Act
      const result = extractPackageFile(content, packageFile, extractConfig);

      // Assert
      expect(result).toBeNull();
    });

    it('returns null when file contents is malformed', () => {
      // Arrange
      const content = 'malformed json}}}';
      const packageFile = '';
      const extractConfig = {};
      // Act
      const result = extractPackageFile(content, packageFile, extractConfig);

      // Assert
      expect(result).toBeNull();
    });

    it('returns feature images when only features is defined', () => {
      // Arrange
      const content = fixtures.featuresOnly.content;
      const packageFile = fixtures.featuresOnly.path;
      const extractConfig = {};
      // Act
      const result = extractPackageFile(content, packageFile, extractConfig);

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

    it('returns image and feature images when both image and features are defined', () => {
      // Arrange
      const content = fixtures.imageAndFeature.content;
      const packageFile = fixtures.imageAndFeature.path;
      const extractConfig = {};
      // Act
      const result = extractPackageFile(content, packageFile, extractConfig);

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

    it('returns image when only image is defined', () => {
      // Arrange
      const content = fixtures.imageOnly.content;
      const packageFile = fixtures.imageOnly.path;
      const extractConfig = {};
      // Act
      const result = extractPackageFile(content, packageFile, extractConfig);

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

    it('returns null when the only feature is malformed and no image is defined', () => {
      // Arrange
      const content = fixtures.malformedFeature.content;
      const packageFile = fixtures.malformedFeature.path;
      const extractConfig = {};
      // Act
      const result = extractPackageFile(content, packageFile, extractConfig);

      // Assert
      expect(result).toBeNull();
    });

    it('returns null when features is malformed and no image is defined', () => {
      // Arrange
      const content = fixtures.malformedFeatures.content;
      const packageFile = fixtures.malformedFeatures.path;
      const extractConfig = {};
      // Act
      const result = extractPackageFile(content, packageFile, extractConfig);

      // Assert
      expect(result).toBeNull();
    });

    it('returns null when image is malformed and no features are defined', () => {
      // Arrange
      const content = fixtures.malformedImage.content;
      const packageFile = fixtures.malformedImage.path;
      const extractConfig = {};
      // Act
      const result = extractPackageFile(content, packageFile, extractConfig);

      // Assert
      expect(result).toBeNull();
    });

    it('returns null when no image or features are defined', () => {
      // Arrange
      const content = fixtures.noImageOrFeatures.content;
      const packageFile = fixtures.noImageOrFeatures.path;
      const extractConfig = {};
      // Act
      const result = extractPackageFile(content, packageFile, extractConfig);

      // Assert
      expect(result).toBeNull();
    });

    it('returns null when features is null and no image is defined', () => {
      // Arrange
      const content = fixtures.nullImage.content;
      const packageFile = fixtures.nullImage.path;
      const extractConfig = {};
      // Act
      const result = extractPackageFile(content, packageFile, extractConfig);

      // Assert
      expect(result).toBeNull();
    });

    it('returns null when both image and features are null', () => {
      // Arrange
      const content = fixtures.nullImageAndFeatures.content;
      const packageFile = fixtures.nullImageAndFeatures.path;
      const extractConfig = {};
      // Act
      const result = extractPackageFile(content, packageFile, extractConfig);

      // Assert
      expect(result).toBeNull();
    });
  });
});
