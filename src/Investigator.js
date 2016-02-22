import combine from 'stream-combiner2';
import concat from 'concat-stream';
import duplexer from 'duplexer2';
import nodeResolve from 'resolve';
import path from 'path';
import question from 'detective-cjs';
import through from 'through2';
import vinylFile from 'vinyl-file';

import Deferred from './Deferred';

import { Duplex } from 'stream';

let babel = require('babel-core');

/**
 * ---------------------------------------------------------------------------
 * Description:
 * ---------------------------------------------------------------------------
 * This stream is responsible for taking input files like your top level
 * app entry points and gathering all their dependencies and subdependencies.
 *
 * It then emits the below output that the EvidenceLocker stream can use to
 * assemble into a tree. This is designed so that you could replace the
 * EvidenceLocker stream with any other kind of stream to assemble the deps
 * however you would like.
 * –––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––
 *
 * ---------------------------------------------------------------------------
 * Input: Vinyl Files
 * ---------------------------------------------------------------------------
 * Output:
 * ---------------------------------------------------------------------------
 * {
 *   suspect: '/path/to/src/Investigator.js,
 *   leads: [
 *     '/path/to/src/deferred.js'
 *   ],
 *   source: null || '/path/to/parent/file'
 * }
 * –––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––
 */

/**
 * Investigator questions, interrogates, and gathers evidence from all
 * the suspects.
 */
export default class Investigator extends Duplex {
  options = {};
  notes = {};
  transformer = null;

  /**
   * Initializes the investigator
   *
   * @constructor
   * @param {object} opts - Initialization opts sent to the stream interface
   * @param {boolean} opts.ignorePackages - Ignore node packages
   */
  constructor (opts={}) {
    super({ objectMode: true });

    this.options = Object.assign({
      compileES6Modules: true,
      ignorePackages: true,
      transforms: [],
    }, opts);

    this._write = this._write.bind(this);

    // When finished push the end signal
    this.on('finish', () => {
      this.interrogated = {};
      this.notes = {};
      this.push(null);
    });
  }

  /**
   * Combines transforms into a single stream then creates a duplex stream
   * outputting the result of all the combined transforms.
   *
   * @param {arary} transformStreams - Array of transforms and\or module names
   * @returns {stream} A duplex stream that will emit the result of all the
   *                   transform streams.
   */
  createTransformer (transformStreams=[]) {
    let input = through(),
        output = through(),
        stream = duplexer(input, output),
        pipeline;

    transformStreams = transformStreams.map(([transformer, opts]) => {
      // If transform is a string try to import it
      if (typeof transformer === 'string') {
        transformer = require(nodeResolve.sync(transformer));
      }

      // Decorate the stream with an error handler
      return transformer(opts)
        .on('error', stream.emit.bind(stream, 'error'));
    });

    // Combine all transforms into a single stream
    pipeline = combine(...transformStreams);

    /**
     * Tell our parent duplex stream to pipe to our pipeline. Then tell our
     * pipeline to pipe to the output stream of our parent duplex..
     */
    input
      .pipe(pipeline)
      .pipe(output);

    return stream;
  }

  /**
   * Roughs up the suspect then questions it for leads
   *
   * @param {vinyl} suspect - A vinyl file to compile
   * @param {string} source - The rat that gave up the suspect
   * @returns {Promise} A promise resolved when all sub investigations are done
   */
  interrogate (suspect, source=null) {
    let leads = [],
        deferred = new Deferred();

    // if (source) {
    //   /**
    //    * If we have visited this suspect from this source before don't trace
    //    * it down again.
    //    */
    //   if (this.isOnRecord(source, suspect.path)) {
    //     deferred.resolve();
    //     return deferred.promise();
    //   }

    //   /**
    //    * Otherwise we can store the source & lead so we don't trace it again
    //    * later.
    //    */
    //   this.record(source, suspect.path);
    // }

    /**
     * Pushes the evidence down the stream.
     */
    function push () {
      this.push({
        suspect: suspect.path,
        leads,
        source,
      });
    }

    if (this.isNoted(suspect)) {
      leads = this.readNotesOn(suspect);
      push.call(this);
      deferred.resolve();
    }

    /**
     *  If this is a new suspect then rough it up, question it, and verify
     *  its statements. Then track down those statements to find new suspects.
     */
    else {
      /**
       * Transform the source to make the suspect spill it’s guts. In coding
       * terms it runs the suspect through the transforms if there are any
       * then resolves with the final transformed source.
       */
      this.roughUp(suspect)
        .then((story) => {
          let investigations = [];

          leads = this.verify(suspect, question(story));

          // Remember this suspect for later.
          this.note(suspect, leads);

          push.call(this);

          // For each lead found start a new investigation
          investigations = leads.map((lead) => {
            return this.trackDown(lead)
              .then((newSuspect) => {
                return this.interrogate(newSuspect, suspect.path);
              })
              .catch(() => {});
          });

          /**
           * Resolve the deferred result with a promise that is resolved when
           * all investigations are complete. (tracing of submodules)
           */
          deferred.resolve(Promise.all(investigations));
        })
        .catch((err) => this.emit('error', err));
    }

    return deferred.promise();
  }

  /**
   * Returns true if the suspect is in our notes.
   *
   * @param {vinyl} suspect - A vinyl file to compile
   * @returns {boolean} True if notes on that suspect exist.
   */
  isNoted (suspect) {
    return this.notes.hasOwnProperty(suspect.path);
  }

  /**
   * Stores the suspect in our notes for future reference.
   *
   * @param {vinyl} suspect - A vinyl file to compile
   * @param {array} leads - Leads the suspect gave up
   */
  note (suspect, leads) {
    this.notes[suspect.path] = leads;
  }

  /**
   * Retrives our notes on the suspect
   *
   * @param {vinyl} suspect - A vinyl file to compile
   * @returns {array} Leads the suspect gave up
   */
  readNotesOn (suspect) {
    return this.notes[suspect.path];
  }

  /**
   * Compiles the ES2015 module import statements into CJS requires.
   *
   * @param {vinyl} suspect - A vinyl file to compile
   * @returns {buffer} New buffer with compiled contents
   */
  roughUp (suspect) {
    let code = suspect.contents.toString('utf8'),
        transforms = this.options.transforms;

    // If the user has specified not to compile ES6 modules then uh don’t.
    if (this.options.compileES6Modules) {
      let result = babel.transform(suspect.contents.toString('utf8'), {
        filename: path.basename(suspect.path),
        babelrc: false,
        presets: ['stage-0'],
        plugins: ['transform-react-jsx', 'transform-es2015-modules-commonjs'],
        sourceMap: false,
      });

      code = result.code;
    }

    return new Promise((resolve, reject) => {
      // If no transform options are given just return the resulting code
      if (!Array.isArray(transforms) || !transforms.length) {
        resolve(code);
        return;
      }

      if (!this.transformer) {
        this.transformer = this.createTransformer(transforms);
      }

      // Create transform stream
      this.transformer.on('error', reject);

      /**
       * Since transforms could push data in any amount of smaller chunks
       * lets buffer them into a single chunk of text with the fully
       * transformed source.
       */
      this.transformer
        .pipe(concat((result) => {
          this.transformer.removeListener('error', reject);
          this.transformer.unpipe();
          resolve(result);
        }));

      this.transformer.end(code);
    });
  }

  /**
   * Takes module id and returns a vinyl file
   *
   * @param {string} lead -
   * @returns {Promise} A promise resolved suspect (vinyl file) from the lead
   */
  trackDown (lead) {
    let deferred = new Deferred();

    vinylFile.read(lead, deferred.callback);

    return deferred.promise();
  }

  /**
   * Adds a transformer and options to the transform function
   *
   * @param {function} transformer - Returns a configured transform stream
   * @param {object} opts - Options to configure the transformer with
   * @returns {object} this For method chaining
   */
  transform (transformer, opts={}) {
    this.options.transforms.push([
      transformer,
      opts,
    ]);

    return this;
  }

  /**
   * Verify leads are legit. But actually if a file has `require('./models')`
   * then lets resolve that from the suspect's absolute path directory name.
   * After we might want to call the custom resolve method specified in the
   * constructor options. That way
   *
   * @param {vinyl} suspect - A vinyl file to compile
   * @param {array} leads - Array of required dependencies we may trace
   * @returns {array} Verified lieds that are resolved & filtered
   */
  verify (suspect, leads) {
    let basedir = path.dirname(suspect.path),
        options = this.options,
        verifiedLeads = leads;

    // Filter leads
    if (options.filter) verifiedLeads = verifiedLeads.filter(options.filter);

    // Try to eliminate the node modules early
    if (options.ignorePackages) {
      verifiedLeads = verifiedLeads.filter((id) => {
        return (id.includes('.js') || id.includes('/'))
          && !id.endsWith('.css')
          && !id.endsWith('.html');
      });
    }

    // Map the ids if a map function has been added
    if (this.options.map) verifiedLeads = verifiedLeads.map(this.options.map);

    // Resolve the packages to an absolute path
    verifiedLeads = verifiedLeads.map((id) => {
      try {
        return nodeResolve.sync(id, {
          basedir,
          extensions: ['.js', '.jsx'],
          packageFilter: this.options.packageFilter,
        });
      }
      catch (err) {
        return null;
      }
    });

    verifiedLeads = verifiedLeads.filter((lead) => !!lead);

    // Filter leads after resolved
    if (options.postFilter) verifiedLeads = leads.filter(options.postFilter);

    /**
     * if ignorePackages is on then packages in the node_moduels dir will be
     * ignored.
     */
    if (options.ignorePackages) {
      verifiedLeads = verifiedLeads.filter((id) => {
        return !id.includes('node_modules');
      });
    }

    // If options.resolve is a not a function then just return the leads as is
    if (typeof options.map !== 'function') return verifiedLeads;

    return verifiedLeads;
  }

  /**
   * Required stream method. We just push files down as dependencies are
   * traced.
   */
  _read () {}

  /**
   * Duplex stream write method. A required method to deal with incoming
   * content which happens to be vinyl files.
   *
   * @param {vinyl} suspect - A vinyl file to compile
   * @param {string} enc - Encoding type. Not used on object mode streams.
   * @param {function} done - Callback when ready for the next suspect.
   */
  _write (suspect, enc, done) {
    this.interrogate(suspect)
      .then(() => {
        done();
      })
      .catch((err) => {
        this.emit('error', err);
      });
  }
}
