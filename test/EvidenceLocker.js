import expect from 'expect';
import Input from './lib/Input';
import EvidenceLocker from '../src/EvidenceLocker';

import { buffer } from 'gulp-util';
import { Transform } from 'stream';

const DATA = {};

DATA.evidence = {
  suspect: '/path/to/a.js',
  leads: [
    '/path/to/b.js',
  ],
};

DATA.basicTree = [{
  suspect: '/path/to/a.js',
  leads: [
    '/path/to/b.js',
  ],
},
{
  suspect: '/path/to/b.js',
  leads: [
    '/path/to/c.js',
  ],
  source: '/path/to/a.js',
},
{
  suspect: '/path/to/c.js',
  leads: [],
  source: '/path/to/b.js',
}];

describe('EvidenceLocker', () => {
  describe('#constructor()', () => {
    it('Should be a stream', () => {
      let locker = new EvidenceLocker();

      expect(locker).toBeA(Transform);
      expect(locker._readableState.objectMode).toBe(true);
      expect(locker._writableState.objectMode).toBe(true);
    });
  });

  describe('#buildCase()', () => {
    it('Should build a recursive tree', () => {
      let locker = new EvidenceLocker(),
          caseFile = {};

      locker.kingpins.push('/path/to/a.js');

      locker.flatList['/path/to/a.js'] = [
        '/path/to/b.js',
      ];

      locker.flatList['/path/to/b.js'] = [
        '/path/to/c.js',
      ];

      caseFile['/path/to/a.js'] = locker.buildCase('/path/to/a.js');

      expect(caseFile['/path/to/a.js']['/path/to/b.js']).toExist();
      expect(caseFile['/path/to/a.js']['/path/to/b.js']['/path/to/c.js']).toExist();
    });
  });

  describe('#file()', () => {
    it('Should store evidence', () => {
      let locker = new EvidenceLocker();

      locker.file(DATA.evidence);

      expect(locker.kingpins).toBeA(Array);
      expect(locker.kingpins[0]).toBe('/path/to/a.js');

      expect(locker.flatList['/path/to/a.js']).toBeA(Array);
      expect(locker.flatList['/path/to/a.js'].length).toBe(1);
      expect(locker.flatList['/path/to/a.js'][0]).toBe('/path/to/b.js');
      expect(locker.flatList['/path/to/b.js']).toBeA(Array);
      expect(locker.flatList['/path/to/b.js'].length).toBe(0);
    });
  });

  describe('#destroy()', () => {
    it('Should destroy the stream', (done) => {
      let locker = new EvidenceLocker();

      locker.on('close', done);

      locker.destroy();
    });
  });

  describe('#get()', () => {
    it('Should return dependencies from an existing item', () => {
      let locker = new EvidenceLocker(),
          result;

      locker.file(DATA.evidence);

      result = locker.get('/path/to/a.js');

      expect(result).toBeA(Array);
      expect(result.length).toBe(1);
      expect(result[0]).toBe('/path/to/b.js');
    });

    it('Should return a new array when given a new item', () => {
      let locker = new EvidenceLocker(),
          result;

      result = locker.get('/path/to/a.js');

      expect(result).toBeA(Array);
      expect(result.length).toBe(0);
    });
  });

  describe('#hasId()', () => {
    it('Should return true if id exists', () => {
      let locker = new EvidenceLocker();

      locker.file(DATA.evidence);

      expect(locker.hasId('/path/to/a.js')).toBe(true);
    });

    it('Should return false if id does not exist', () => {
      let locker = new EvidenceLocker();

      expect(locker.hasId('/path/to/a.js')).toBe(false);
    });
  });

  describe('#transform()', () => {
    it('Should transform the dependency inputs into a tree', (done) => {
      let locker = new EvidenceLocker(),
          input = new Input(DATA.basicTree);

      input
        .pipe(locker)
        .pipe(buffer((err, contents) => {
          let caseFile = contents[0];

          expect(caseFile['/path/to/a.js']).toExist();
          expect(caseFile['/path/to/a.js']['/path/to/b.js']).toExist();
          expect(caseFile['/path/to/a.js']['/path/to/b.js']['/path/to/c.js']).toExist();

          done();
        }));
    });
  });
});
