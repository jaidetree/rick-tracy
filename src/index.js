import CaseReporter from './CaseReporter';
import Investigator from './Investigator';
import EventEmitter from 'events';
import EvidenceLocker from './EvidenceLocker';
import splicer from 'labeled-stream-splicer';
import vfs from 'vinyl-fs';

/**
 * @example
 * import fs from 'fs';
 * import JSONStream from 'JSONStream';
 * import RickTracy from 'rick-tracy';
 *
 * let rickTracy = new RickTracy({
 *   // the usual suspects ;)
 *   lineup: 'path/to/entry/points/**\/*.js'
 * });
 *
 * // Build the dependency graph and write to a writable stream
 * rickTracy.investigate()
 *  .pipe(JSONStream.stringify())
 *  .pipe(fs.createWriteStream('out.txt'))
 *
 * // Or get the tree from the complete handler
 * rickTracy.investigate()
 *  .on('complete', (caseFile) => {
 *    console.log(caseFile);
 *  });
 *
 * // Or retrive it from a writable callback
 * rickTracy.investigate()
 *  .pipe(rickTracy.report((caseFile) => {
 *    console.log(caseFile);
 *  });
 *
 * // Modify the pipeline
 *
 * // Writes the depdendency tree to a text file as part of the pipeline
 * let output = new fs.createWriteStream('tree.txt');
 *
 * rickTracy.pipeline.get('trace').unshift(through2.obj((file, enc, done) => {
 *   // Allows you to modify the
 *   console.log(file);
 *   done(null, file);
 * }));
 * rickTracy.pipline.get('report').push(output);
 */

/**
 * Exposed module api
 * @extends {EventEmitter}
 * @property {object} caseFile - Finished dependency graph
 * @property {boolean} isComplete - If the tracing is complete yet
 * @property {array} process - The list of methods in the order they are
 *                             added to the stream splicer pipeline.
 */
export default class RickTracy extends EventEmitter {
  caseFile = {};

  isComplete = false;

  process = [
    'trace',
    'store',
  ];

  /**
   * @constructor
   * @param {object} opts - Initial investigation options
   * @param {string} opts.lineup - Glob string of files to search for
   * @param {object} opts.trace - Tracing options
   * @param {function} opts.trace.filter - Filter function to determine which
   *                                       ids to skip resolving.
   * @param {function} opts.trace.packageFilter - Transform method on packages
   * @param {function} opts.trace.postFilter - Filter function to determine if
   *                                           a resolved id should be parsed.
   */
  constructor (opts={}) {
    super();

    this.options = {
      lineup: '**/*.js',
      trace: {
        ignorePackages: true, // Don't trace node_modules
        compileES6Modules: true, // Use babel to compile imports into require.
      },
      evidence: {},
    };

    // Extend the default options by each subkey
    Object.keys(opts).forEach((key) => {
      if (typeof this.options[key] === 'object') {
        Object.assign(this.options[key], opts[key]);
      }
      else if (typeof this.options[key] === 'string') {
        this.options[key] = opts[key];
      }
    });

    this.pipeline = this.createPipeline();
  }

  /**
   * Creates our labeled stream splicer instance. This allows users to
   * customize the flow of data between phases. For instance if users wanted
   * to assemble the data into a different kind of data structure or graphing
   * UI they could replace out the store step.
   *
   * @returns {stream} Labeled stream splicer instance
   */
  createPipeline () {
    let pipeline = [];

    // Build our stream splicer array which is ['label', stream()]
    this.process.forEach((label) => {
      pipeline.push(label);
      pipeline.push([this.passTo(`_${label}`)]);
    });

    // Return our splicer instance
    return splicer.obj(pipeline);
  }

  /**
   * Begins tracing the dependenceis and piping the vinyl files into our
   * pipeline.
   *
   * @returns {stream} Resulting stream from the pipeline.
   */
  investigate () {
    return vfs.src(this.options.lineup, {
      cwd: this.options.cwd || process.cwd(),
      base: this.options.base,
    })
    .pipe(this.pipeline);
  }

  /**
   * Event handler when the caseFile (dependency graph) has been assembled
   *
   * @param {object} caseFile - Finalized dependency tree
   */
  onComplete (caseFile) {
    this.isComplete = true;
    this.caseFile = caseFile;
    this.emit('complete', caseFile);
  }

  /**
   * Basic method to wrap the stream with an error handler
   * @param {string} methodName - Stream returning method to add to pipeline
   * @returns {stream} A stream wrapped with an error handler
   */
  passTo (methodName) {
    return this[methodName](this.options)
      .on('error', this.emit.bind(this, 'error'));
  }

  /**
   * Simple reporter to get back the finished case file
   * @param {function} cb - Callback to fire when finished
   * @returns {stream.Writable} A writable stream to store the final case file
   */
  report (cb) {
    return new CaseReporter((caseFile) => {
      cb(caseFile);
      this.onComplete(caseFile);
    });
  }

  /**
   * Traces our dependencies. Takes an input of vinyl files and produces an
   * object detailing each dependency and its parent and children.
   *
   * @param {object} options - Our initial options passed to class constructor
   * @returns {stream} A stream to be used in the main pipeline
   */
  _trace (options) {
    return new Investigator(options.investigate);
  }

  /**
   * Stores our dependencies and outputs a tree
   *
   * @param {object} options - Our initial options passed to class constructor
   * @returns {stream} A stream to be used in the main pipeline
   */
  _store (options) {
    return new EvidenceLocker(options.evidence);
  }
}
