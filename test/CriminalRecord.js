import expect from 'expect';
import CriminalRecord from '../src/CriminalRecord';

describe('CriminalRecord', () => {
  describe('#constructor()', () => {
    it('Should create a criminal record instance', () => {
      let record = new CriminalRecord();

      expect(record).toBeA(CriminalRecord);
    });
  });

  describe('#has()', () => {
    it('Should return true if both lead & suspect match', () => {
      let record = new CriminalRecord();

      record.cabinet = [
        ['one', 'a'],
        ['two', 'b'],
        ['three', 'd'],
      ];

      expect(record.has('one', 'a')).toBe(true);
      expect(record.has('two', 'b')).toBe(true);
      expect(record.has('three', 'd')).toBe(true);
      expect(record.has('three', 'c')).toBe(false);
      expect(record.has('four', 'e')).toBe(false);
    });
  });

  describe('#store()', () => {
    it('Should store records', () => {
      let record = new CriminalRecord();

      record.store('one', 'a');

      expect(record.cabinet.length).toBe(1);
      expect(record.cabinet[0].length).toBe(2);
      expect(record.cabinet[0][0]).toBe('one');
      expect(record.cabinet[0][1]).toBe('a');
    });
  });
});
