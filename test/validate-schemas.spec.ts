import fs from 'fs-extra';
import upath from 'upath';
import { Json } from '../lib/util/schema-utils';
import { capitalize } from '../tools/docs/utils';
import * as Schemas from '../tools/schemas/schema';

const dataFileDir = 'lib/data';
const schemaDir = 'tools/schemas';
const schemasAndJsonFiles: {
  schemaName: keyof typeof Schemas;
  dataFileName: string;
}[] = [];

describe('validate-schemas', () => {
  it('validate json files in lib/data against their schemas', async () => {
    const schemaFiles = (await fs.readdir(schemaDir)).filter(
      (file) => upath.extname(file) === '.json',
    );

    for (const schemaFile of schemaFiles) {
      const correspondingDatFileName = schemaFile.replace('-schema', '');
      const schemaName = `${schemaFile
        .replace('.json', '')
        .split('-')
        .map(capitalize)
        .join('')}` as keyof typeof Schemas;
      schemasAndJsonFiles.push({
        schemaName,
        dataFileName: correspondingDatFileName,
      });
    }

    await Promise.all(
      schemasAndJsonFiles.map(async ({ schemaName, dataFileName }) => {
        const data = Json.parse(
          await fs.readFile(upath.join(dataFileDir, dataFileName), 'utf8'),
        );

        let result: Record<string, unknown> =
          // eslint-disable-next-line import/namespace
          Schemas[schemaName].safeParse(data);
        result = { ...result, dataFileName, schemaName };
        expect(result).toMatchObject({
          dataFileName,
          schemaName,
          success: true,
        });
      }),
    );
  });
});
