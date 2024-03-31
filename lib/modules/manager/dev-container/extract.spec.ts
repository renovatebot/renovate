import upath from 'upath';
import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from './extract';

const fixturesDir = '__fixtures__';
const noImageOrFeaturesDevContainerJson =
  '.devcontainer.noimageorfeatures.json';
const featuresOnlyDevContainerjson = '.devcontainer.featuresonly.json';
const imageAndFeatureDevContainerJson = '.devcontainer.imageandfeature.json';

const noImageOrFeatures = {
  content: Fixtures.get(noImageOrFeaturesDevContainerJson),
  path: upath.resolve(
    __dirname,
    fixturesDir,
    noImageOrFeaturesDevContainerJson,
  ),
};

const featuresOnly = {
  content: Fixtures.get(featuresOnlyDevContainerjson),
  path: upath.resolve(__dirname, fixturesDir, featuresOnlyDevContainerjson),
};

const imageAndFeature = {
  content: Fixtures.get(imageAndFeatureDevContainerJson),
  path: upath.resolve(__dirname, fixturesDir, imageAndFeatureDevContainerJson),
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

    it('returns null when no image or features are defined', () => {
      // Arrange
      const content = noImageOrFeatures.content;
      const packageFile = noImageOrFeatures.path;
      const extractConfig = {};
      // Act
      const result = extractPackageFile(content, packageFile, extractConfig);

      // Assert
      expect(result).toBeNull();
    });

    it('returns feature images when only features is defined', () => {
      // Arrange
      const content = featuresOnly.content;
      const packageFile = featuresOnly.path;
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

    it('returns image and feature images when bother image and features are defined', () => {
      // Arrange
      const content = imageAndFeature.content;
      const packageFile = imageAndFeature.path;
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
  });
});
