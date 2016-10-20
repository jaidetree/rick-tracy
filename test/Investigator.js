import concat from 'concat-stream';
import expect from 'expect';
import fs from 'fs';
import Input from './lib/Input';
import Investigator from '../src/Investigator';
import path from 'path';
import through from 'through2';

import { File } from 'gulp-util';
import { Duplex } from 'stream';

const DATA = {};

DATA.suspects = {};
DATA.suspects.a = path.join(__dirname, 'fixtures/a.js');
DATA.suspects.b = path.join(__dirname, 'fixtures/b.js');
DATA.suspects.c = path.join(__dirname, 'fixtures/c.js');

DATA.deps = [
  {
    suspect: DATA.suspects.a,
    leads: [
      DATA.suspects.b,
    ],
    source: null,
  },
  {
    suspect: DATA.suspects.b,
    leads: [
      DATA.suspects.c,
    ],
    source: DATA.suspects.a,
  },
  {
    suspect: DATA.suspects.c,
    leads: [],
    source: DATA.suspects.b,
  },
];

/**
 * Basic transformer that increments the input number by one
 *
 * @returns {stream.transform} A basic transform stream
 */
function basicTransformer () {
  return through(function (buf, enc, done) {
    this.push(new Buffer(String(Number(buf.toString()) + 1)));
    done();
  });
}

/**
 * Creates a vinyl file instance
 *
 * @param {string} filepath - Absolute path to file
 * @returns {vinyl} Vinyl file wrapper object instance
 */
function createFile (filepath) {
  return new File({
    base: path.dirname(filepath),
    cwd: __dirname,
    path: filepath,
    contents: fs.readFileSync(filepath),
  });
}

/**
 * Create a list of transforms
 *
 * @returns {array} List of transforms that add numbers
 */
function createTransformersArray () {
  return [
    [basicTransformer, {}],
    [basicTransformer, {}],
  ];
}

/**
 * Code transformer test stream
 *
 * @param {object} opts - Options to configure the transform with
 * @returns {stream.Transform} A transform stream
 */
function codeTransformer (opts) {
  return through(function (code, enc, done) {
    let result = String(Number(code.toString()) + opts.val);

    this.push(result);
    done();
  });
}

describe('Investigator', () => {
  describe('#constructor()', () => {
    it('Should be a duplex stream', () => {
      let investigator = new Investigator();

      expect(investigator).toBeA(Duplex);
    });
  });

  describe('#createTransformer()', () => {
    it('Should create a duplex stream', () => {
      let investigator = new Investigator(),
          streams = createTransformersArray(),
          transformer = investigator.createTransformer(streams);

      expect(transformer._readable).toExist();
      expect(transformer._readable._transform).toBeA(Function);
      expect(transformer._writable).toExist();
      expect(transformer._writable._transform).toBeA(Function);
    });

    it('Should iteratively transform content', (done) => {
      let investigator = new Investigator(),
          streams = createTransformersArray(),
          transformer = investigator.createTransformer(streams),
          input = new Input(['1']);

      input
        .pipe(transformer)
        .pipe(concat((buf) => {
          let num = buf.toString();

          expect(num).toBe('3');
          done();
        }));
    });
  });

  describe('#interrogate()', () => {
    it('Should trace dependencies', (done) => {
      let investigator = new Investigator(),
          suspect = createFile(DATA.suspects.a),
          spy = expect.createSpy().andCall((data, enc, next) => {
            next(null, data);
          }),
          result;

      investigator
        .pipe(through.obj(spy));

      result = investigator.interrogate(suspect);
      expect(result).toBeA(Promise);

      result
        .then(() => {
          let data = spy.calls[0].arguments[0];

          expect(data.suspect).toBeA('string');
          expect(data.suspect).toBe(DATA.suspects.a);
          expect(data.leads).toBeA(Array);
          expect(data.leads.length).toBe(1);
          expect(data.leads[0]).toBe(DATA.suspects.b);

          return true;
        })
        .then(() => {
          let data = spy.calls[1].arguments[0];

          expect(data.suspect).toBeA('string');
          expect(data.suspect).toBe(DATA.suspects.b);
          expect(data.leads).toBeA(Array);
          expect(data.leads.length).toBe(1);
          expect(data.leads[0]).toBe(DATA.suspects.c);

          return true;
        })
        .then(() => {
          expect(spy.calls.length).toBe(3);
          done();
        })
        .catch((err) => {
          console.error(err.stack || err.message || err);
        });
    });
  });

  describe('#isNoted()', () => {
    it('Should return true if notes exist', () => {
      let investigator = new Investigator();

      investigator.note(DATA.suspects.a, [
        DATA.suspects.b,
      ]);

      expect(investigator.isNoted(DATA.suspects.a)).toBe(true);
    });

    it('Should return false if note does not exist', () => {
      let investigator = new Investigator();

      expect(investigator.isNoted(DATA.suspects.a)).toBe(false);
    });
  });

  describe('#note()', () => {
    it('Should store a note', () => {
      let investigator = new Investigator();

      investigator.note({ path: DATA.suspects.a }, [
        DATA.suspects.b,
      ]);

      expect(investigator.notes[DATA.suspects.a]).toBeA(Array);
      expect(investigator.notes[DATA.suspects.a][0]).toBe(DATA.suspects.b);
    });
  });

  describe('#readNotesOn()', () => {
    it('Should return the note for the given index', () => {
      let investigator = new Investigator(),
          leads = [
            DATA.suspects.b,
          ],
          note;

      investigator.note({ path: DATA.suspects.a }, leads);

      expect(investigator.readNotesOn(DATA.suspects.a)).toEqual(note);
    });
  });

  describe('#roughUp()', () => {
    it('Should transform ES6 when compileES6Modules is not set', () => {
      let investigator = new Investigator();

      return investigator
        .roughUp({
          contents: "import a from './a';",
          path: 'hello/world/test.js',
        })
        .then((code) => {
          expect(code).toInclude('require');
          expect(code).toExclude('import');
        });
    });

    it('Should transform ES6 when compileES6Modules is true', () => {
      let investigator = new Investigator({
        compileES6Modules: true,
      });

      return investigator
        .roughUp({
          contents: "import a from './a';",
          path: 'hello/world/test.js',
        })
        .then((code) => {
          expect(code).toInclude('require');
          expect(code).toExclude('import');
        });
    });

    it('Should not transform ES6 when compileES6Modules is false', () => {
      let investigator = new Investigator({
        compileES6Modules: false,
      });

      return investigator
        .roughUp({ contents: "import a from './a';" })
        .then((code) => {
          expect(code).toExclude('require');
          expect(code).toInclude('import');
        });
    });

    it('Should apply transforms to input source code', () => {
      let investigator = new Investigator({
        compileES6Modules: false,
      });

      investigator
        .transform(codeTransformer, { val: 2 })
        .transform(codeTransformer, { val: 5 });

      return investigator
        .roughUp({ contents: new Buffer('1') })
        .then((code) => {
          expect(Number(code.toString())).toBe(8);
        });
    });
  });

  describe('#trackDown()', () => {
    it('Should emit a vinyl file', () => {
      let investigator = new Investigator();

      return investigator
        .trackDown(DATA.suspects.a)
        .then((file) => {
          expect(file.contents).toBeA(Buffer);
          expect(file.path).toBeA('string');
          expect(file.path).toBe(DATA.suspects.a);
        });
    });
  });

  describe('#verify()', () => {
    it('Should resolve paths', () => {
      let investigator = new Investigator(),
          leads;

      leads = investigator
        .verify({ path: DATA.suspects.a }, [
          './b.js',
        ]);

      expect(leads).toBeA(Array);
      expect(leads.length).toBe(1);
      expect(leads[0]).toBe(DATA.suspects.b);
    });

    it('Should allow filtering of paths', () => {
      let spy = expect.createSpy().andReturn(false),
          investigator = new Investigator({
            filter: spy,
          }),
          leads;

      leads = investigator
        .verify({ path: DATA.suspects.a }, [
          './b.js',
        ]);

      expect(spy).toHaveBeenCalled();
      expect(spy.calls.length).toBe(1);
      expect(leads.length).toBe(0);
    });

    it('Should allow post-filtering of paths', () => {
      let spy = expect.createSpy().andReturn(false),
          investigator = new Investigator({
            postFilter: spy,
          }),
          leads;

      leads = investigator
        .verify({ path: DATA.suspects.a }, [
          './b.js',
        ]);

      expect(spy).toHaveBeenCalled();
      expect(spy.calls.length).toBe(1);
      expect(leads.length).toBe(0);
    });
  });

  describe('#write()', () => {
    it('Should find all the depdendencies', (done) => {
      let file = createFile(DATA.suspects.a),
          investigator = new Investigator();

      investigator.pipe(concat((deps) => {
        expect(deps.length).toBe(3);
        expect(deps).toBeA(Array);
        expect(deps).toEqual(DATA.deps);
        done();
      }));

      investigator.end(file);
    });
  });
});
