import babel from 'babel-core';
import path from 'path';
import question from 'detective-cjs';
import resolve from 'resolve';
import vinylFile from 'vinyl-file';

import Deferred from './Deferred';

import { Duplex } from 'stream';

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
      ignorePackages: true,
    }, opts);

    this.notes = {};
    this._write = this._write.bind(this);

    // When finished push the end signal
    this.on('finish', () => {
      console.log('Finished!');
      this.push(null);
    });
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
        investigations = [],
        isNoted = this.isNoted(suspect);

    if (isNoted) {
      leads = this.readNotesOn(suspect);
    }

    /**
     *  If this is a new suspect then rough it up, question it, and verify
     *  its statements. Then track down those statements to find new suspects.
     */
    else {
      suspect.contents = this.roughUp(suspect);
      leads = this.verify(suspect, question(suspect.contents));

      // Remember this suspect for later.
      this.note(suspect, leads);

      // For each lead found start a new investigation
      leads.forEach((lead) => {
        investigations.push(this.trackDown(lead).then((newSuspect) => {
          return this.interrogate(newSuspect, suspect.path);
        }));
      });
    }

    this.push({
      suspect: suspect.path,
      leads,
      source,
    });

    return Promise.all(investigations);
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
    let result = babel.transform(suspect.contents.toString('utf8'), {
      babelrc: false,
      plugins: ['transform-es2015-modules-commonjs'],
      sourceMap: false,
    });

    return new Buffer(result.code);
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

    return deferred;
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
        verifiedLeads = [];

    // Resolve the packages to an absolute path
    verifiedLeads = leads.map((id) => resolve.sync(id, {
      basedir,
      extensions: ['.js', '.jsx'],
    }));

    /**
     * if ignorePackages is on then packages in the node_moduels dir will be
     * ignored.
     */
    if (this.options.ignorePackages) {
      verifiedLeads = verifiedLeads.filter((id) => {
        return !id.includes('node_modules');
      });
    }

    // If options.resolve is a not a function then just return the leads as is
    if (typeof this.options.resolve !== 'function') return verifiedLeads;

    // Use the custom resolve method to further locate things
    return verifiedLeads.map(this.options.resolve);
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
      .then(() => done());
  }
}
