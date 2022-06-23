import { prepareLabels } from './labels';

describe('workers/repository/update/pr/labels', () => {
  describe('prepareLabels(config)', () => {
    it('returns empty array if no labels are configured', () => {
      const result = prepareLabels({});
      expect(result).toBeArrayOfSize(0);
    });

    it('only labels', () => {
      const result = prepareLabels({ labels: ['labelA', 'labelB'] });
      expect(result).toBeArrayOfSize(2);
      expect(result).toEqual(['labelA', 'labelB']);
    });

    it('only addLabels', () => {
      const result = prepareLabels({
        addLabels: ['labelA', 'labelB'],
      });
      expect(result).toBeArrayOfSize(2);
      expect(result).toEqual(['labelA', 'labelB']);
    });

    it('merge labels and addLabels', () => {
      const result = prepareLabels({
        labels: ['labelA', 'labelB'],
        addLabels: ['labelC'],
      });
      expect(result).toBeArrayOfSize(3);
      expect(result).toEqual(['labelA', 'labelB', 'labelC']);
    });

    it('deduplicate merged labels and addLabels', () => {
      const result = prepareLabels({
        labels: ['labelA', 'labelB'],
        addLabels: ['labelB', 'labelC'],
      });
      expect(result).toBeArrayOfSize(3);
      expect(result).toEqual(['labelA', 'labelB', 'labelC']);
    });

    it('empty labels ignored', () => {
      const result = prepareLabels({
        labels: ['labelA', ''],
        addLabels: [' ', 'labelB'],
      });
      expect(result).toBeArrayOfSize(2);
      expect(result).toEqual(['labelA', 'labelB']);
    });

    it('null labels ignored', () => {
      // TODO #7154
      const result = prepareLabels({
        labels: ['labelA', null] as never,
        // an empty space between two commas in an array is categorized as a null value
        // eslint-disable-next-line no-sparse-arrays
        addLabels: ['labelB', '', undefined, , ,] as never,
      });
      expect(result).toBeArrayOfSize(2);
      expect(result).toEqual(['labelA', 'labelB']);
    });

    it('template labels', () => {
      const result = prepareLabels({
        labels: ['datasource-{{{datasource}}}'],
        datasource: 'npm',
      });
      expect(result).toBeArrayOfSize(1);
      expect(result).toEqual(['datasource-npm']);
    });

    it('template labels with empty datasource', () => {
      const result = prepareLabels({
        labels: ['{{{datasource}}}', ' {{{datasource}}} '],
        datasource: null,
      });
      expect(result).toBeArrayOfSize(0);
      expect(result).toEqual([]);
    });
  });
});
