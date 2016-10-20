import expect from 'expect';
import path from 'path';
import EvidenceLocker from '../src/EvidenceLocker';
import Investigator from '../src/Investigator';
import RickTracy from '../src';

const DATA = {};

/**
 * Joins the given filename to the base directory
 * @param {string} file - Filename to join
 * @returns {string} appended file name
 */
function join (file) {
  return path.join(DATA.base, file);
}

DATA.base = path.resolve(__dirname, '..', 'src');

DATA.tree = {
  [join('CaseReporter.js')]: {},
  [join('Deferred.js')]: {},
  [join('CriminalRecord.js')]: {},
  [join('EvidenceLocker.js')]: {
    [join('CriminalRecord.js')]: {},
  },
  [join('Investigator.js')]: {
    [join('Deferred.js')]: {},
  },
  [join('index.js')]: {
    [join('CaseReporter.js')]: {},
    [join('Deferred.js')]: {},
    [join('Investigator.js')]: {
      [join('Deferred.js')]: {},
    },
    [join('EvidenceLocker.js')]: {
      [join('CriminalRecord.js')]: {},
    },
  },
};

describe('RickTracy', () => {
  describe('#constructor()', () => {
    it('Should create a pipeline', () => {
      let rick = new RickTracy();

      expect(Object.keys(Object.getPrototypeOf(rick.pipeline))).toEqual([
        'indexOf',
        'get',
        'splice',
      ]);

      expect(rick.pipeline.get('trace').get(0)).toBeA(Investigator);
      expect(rick.pipeline.get('store').get(0)).toBeA(EvidenceLocker);
    });
  });

  describe('#investigate()', () => {
    it('Should trace dependencies', () => {
      let rick = new RickTracy({
        lineup: '../src/**/*.js',
      });

      return rick.investigate()
        .then((caseFile) => {
          expect(caseFile).toExist();
          expect(caseFile).toEqual(DATA.tree);
        });
    });
  });
});
