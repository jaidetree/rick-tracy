import { Transform } from 'stream';

/**
 * ---------------------------------------------------------------------------
 * Input:
 * ---------------------------------------------------------------------------
 * {
 *   suspect: '/path/to/src/Investigator.js,
 *   leads: [
 *     '/path/to/src/deferred.js'
 *   ],
 *   source: null || '/path/to/parent/file'
 * }
 * ---------------------------------------------------------------------------
 * Output:
 * ---------------------------------------------------------------------------
 * {
 *   '/path/to/src/Investigator.js': {
 *     '/path/to/src/deferred.js': {}
 *   },
 * }
 * –––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––
 */

export default class EvidenceLocker extends Transform {

  /**
   * Initializes writable stream interface.
   *
   * @param {object} opts - Custom options for the record
   */
  constructor (opts={}) {
    super({ objectMode: true });

    // Initialize our options
    this.options = Object.assign({}, opts);
    this.flatList = {};
    this.caseFile = {};
    this.kingpins = [];

    // Taken from the through2 source
    this._destroyed = false;
  }

  /**
   * Reursively build the case file object.
   *
   * @param {string} suspect - Id of suspect (absolute module path)
   * @param {int} [level=0] - Recursion level
   * @returns {object} Mutated case file
   */
  buildCase (suspect, level=0) {
    let leads = this.get(suspect),
        file = {};

    /** For each lead build a case against them too */
    leads.forEach((lead) => {
      file[lead] = this.buildCase(lead, level + 1);
    });

    return file;
  }

  /**
   * Makes this stream destroyable. I copied this from through2 to be
   * consistent with those transform streams.
   *
   * @param {object} err - Error reason why destroy was called.
   */
  destroy (err) {
    if (this._destroyed) return;
    this._destroyed = true;

    process.nextTick(() => {
      if (err) self.emit('error', err);
      this.emit('close');
    });
  }

  /**
   * Stores the evidence in our casefile. Though in code terms it is taking
   * a small object and adding it to the tree as many times as that module
   * id is referenced.
   *
   * @param {object} evidence - A basic object with deps, id, and source if
   *                            it is not a root file.
   */
  file (evidence) {
    let { leads, source, suspect } = evidence,
        suspectFile = this.get(suspect);

    leads.forEach((lead) => {
      /** add to the flat file if there is not an entree already */
      this.get(lead);

      /**  */
      if (suspectFile.indexOf(lead) === -1) suspectFile.push(lead);
    });

    /** Store an array pointing to our root modules */
    if (!source) this.kingpins.push(suspect);
  }

  /**
   * Returns the flatlist look up of a module id
   *
   * @param {string} id - Module id or absolute path to use
   * @returns {object} Either a reference to the original id or the flat list
   */
  get (id) {
    if (!this.hasId(id)) this.flatList[id] = [];

    return this.flatList[id];
  }

  /**
   * Determine if id exists in our flat tree
   *
   * @param {string} id - Module id or absolute path to use
   * @returns {boolean} True if id exists in our flat list.
   */
  hasId (id) {
    return this.flatList.hasOwnProperty(id);
  }

  /**
   * Required stream method to flush our buffer down to the next stream.
   *
   * @param {function} done - Callback when done flushing our data
   */
  _flush (done) {
    let caseFile = this.caseFile;

    this.kingpins.forEach((kingpin) => {
      caseFile[kingpin] = this.buildCase(kingpin, 0);
    });

    this.push(caseFile);
    done();
  }

  /**
   * Required stream implementation method to transform.
   *
   * @param {object} evidence - Evidence found during investigation (tracing)
   * @param {string} enc - Encoding type. Not used in object mode streams.
   * @param {function} done - Callback to fire when done filing the evidence.
   */
  _transform (evidence, enc, done) {
    this.file(evidence);
    done();
  }
}
