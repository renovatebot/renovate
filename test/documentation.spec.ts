import fs from 'fs-extra';
import { glob } from 'glob';
import { getOptions } from '../lib/config/options';
import { regEx } from '../lib/util/regex';

const options = getOptions();
const markdownGlob = '{docs,lib}/**/*.md';

describe('documentation', () => {
  it('has no invalid links', async () => {
    const markdownFiles = await glob(markdownGlob);

    await Promise.all(
      markdownFiles.map(async (markdownFile) => {
        const markdownText = await fs.readFile(markdownFile, 'utf8');
        expect(markdownText).not.toMatch(regEx(/\.md\/#/));
      }),
    );
  });

  describe('website-documentation', () => {
    function getConfigOptionSubHeaders(
      file: string,
      configOption: string,
    ): string[] {
      const subHeadings = [];
      const content = fs.readFileSync(`docs/usage/${file}`, 'utf8');
      const reg = `##\\s${configOption}(?<subHeadersStr>[\\s\\S]+?)\n##\\s`;
      const match = content.match(reg);
      const subHeadersMatch = match?.[0]?.matchAll(/\n###\s(?<child>\w+)\n/g);
      if (subHeadersMatch) {
        for (const subHeaderStr of subHeadersMatch) {
          if (subHeaderStr?.groups?.child) {
            subHeadings.push(subHeaderStr.groups.child);
          }
        }
      }
      return subHeadings;
    }

    describe('docs/usage/configuration-options.md', () => {
      function getConfigHeaders(file: string): string[] {
        const content = fs.readFileSync(`docs/usage/${file}`, 'utf8');
        const matches = content.match(/\n## (.*?)\n/g) ?? [];
        return matches.map((match) => match.substring(4, match.length - 1));
      }

      function getRequiredConfigOptions(): string[] {
        return options
          .filter((option) => !option.globalOnly)
          .filter((option) => !option.parents)
          .filter((option) => !option.autogenerated)
          .map((option) => option.name)
          .sort();
      }

      it('has doc headers sorted alphabetically', () => {
        expect(getConfigHeaders('configuration-options.md')).toEqual(
          getConfigHeaders('configuration-options.md').sort(),
        );
      });

      it('has headers for every required option', () => {
        expect(getConfigHeaders('configuration-options.md')).toEqual(
          getRequiredConfigOptions(),
        );
      });

      function getConfigSubHeaders(file: string): string[] {
        const content = fs.readFileSync(`docs/usage/${file}`, 'utf8');
        const matches = content.match(/\n### (.*?)\n/g) ?? [];
        return matches
          .map((match) => match.substring(5, match.length - 1))
          .sort();
      }

      function getRequiredConfigSubOptions(): string[] {
        return options
          .filter((option) => option.stage !== 'global')
          .filter((option) => !option.globalOnly)
          .filter((option) => option.parents)
          .map((option) => option.name)
          .sort();
      }

      function getParentNames(): Set<string> {
        const childrens = options
          .filter((option) => option.stage !== 'global')
          .filter((option) => !option.globalOnly)
          .filter((option) => option.parents);

        const parentNames = new Set<string>();
        for (const children of childrens) {
          const parents = children.parents ?? [];
          for (const parent of parents) {
            parentNames.add(parent);
          }
        }

        return parentNames;
      }

      it('has headers for every required sub-option', () => {
        expect(getConfigSubHeaders('configuration-options.md')).toEqual(
          getRequiredConfigSubOptions(),
        );
      });

      it.each([...getParentNames()])(
        '%s has sub-headers sorted alphabetically',
        (parentName: string) => {
          expect(
            getConfigOptionSubHeaders('configuration-options.md', parentName),
          ).toEqual(
            getConfigOptionSubHeaders(
              'configuration-options.md',
              parentName,
            ).sort(),
          );
        },
      );
    });

    describe('docs/usage/self-hosted-configuration.md', () => {
      function getSelfHostedHeaders(file: string): string[] {
        const content = fs.readFileSync(`docs/usage/${file}`, 'utf8');
        const matches = content.match(/\n## (.*?)\n/g) ?? [];
        return matches.map((match) => match.substring(4, match.length - 1));
      }

      function getRequiredSelfHostedOptions(): string[] {
        return options
          .filter((option) => option.globalOnly)
          .map((option) => option.name)
          .sort();
      }

      it('has headers sorted alphabetically', () => {
        expect(getSelfHostedHeaders('self-hosted-configuration.md')).toEqual(
          getSelfHostedHeaders('self-hosted-configuration.md').sort(),
        );
      });

      it('has headers for every required option', () => {
        expect(getSelfHostedHeaders('self-hosted-configuration.md')).toEqual(
          getRequiredSelfHostedOptions(),
        );
      });
    });

    describe('docs/usage/self-hosted-experimental.md', () => {
      function getSelfHostedExperimentalConfigHeaders(file: string): string[] {
        const content = fs.readFileSync(`docs/usage/${file}`, 'utf8');
        const matches = content.match(/\n## (.*?)\n/g) ?? [];
        return matches.map((match) => match.substring(4, match.length - 1));
      }

      it('has headers sorted alphabetically', () => {
        expect(
          getSelfHostedExperimentalConfigHeaders('self-hosted-experimental.md'),
        ).toEqual(
          getSelfHostedExperimentalConfigHeaders(
            'self-hosted-experimental.md',
          ).sort(),
        );
      });
    });
  });
});
