import fs from 'fs-extra';
import upath from 'upath';
import { Json } from '../../lib/util/schema-utils';
import { capitalize } from '../../lib/util/string';
import * as Schemas from '../../tools/schemas/schema';

describe('other/validate-schemas', () => {
  it('validate json files in lib/data against their schemas', async () => {
    const dataFileDir = 'lib/data';
    const schemaDir = 'tools/schemas';
    const schemasAndJsonFiles: {
      schemaName: keyof typeof Schemas;
      dataFileName: string;
    }[] = [];

    const schemaFiles = (await fs.readdir(schemaDir)).filter(
      (file) => upath.extname(file) === '.json',
    );

    for (const schemaFile of schemaFiles) {
      const correspondingDataFileName = schemaFile.replace('-schema', '');
      const schemaName = `${schemaFile
        .replace('.json', '')
        .split('-')
        .map(capitalize)
        .join('')}` as keyof typeof Schemas;
      schemasAndJsonFiles.push({
        schemaName,
        dataFileName: correspondingDataFileName,
      });
    }

    const settledPromises = await Promise.allSettled(
      schemasAndJsonFiles.map(async ({ schemaName, dataFileName }) => {
        const data = Json.parse(
          await fs.readFile(upath.join(dataFileDir, dataFileName), 'utf8'),
        );

        // validate json data against schema: using parse here instead of safeParse so we throw
        // this leads to a better error message when the assertion fails
        // eslint-disable-next-line import-x/namespace
        Schemas[schemaName].parse(data);
      }),
    );

    for (let i = 0; i < settledPromises.length; i++) {
      const { schemaName, dataFileName } = schemasAndJsonFiles[i];
      const res = {
        schemaName,
        dataFileName,
        settledPromise: { reason: undefined, ...settledPromises[i] },
      };

      expect(res).toMatchObject({
        schemaName,
        dataFileName,
        settledPromise: {
          status: 'fulfilled',
          reason: undefined,
        },
      });
    }
  });
});
