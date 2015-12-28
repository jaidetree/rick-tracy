import { Writable } from 'stream';

export class Recorder extends Writable {

  /**
   * Initializes writable stream interface.
   *
   * @param {function} cb - Callback to fire when all the evidence is filed.
   * @param {object} opts - Custom options for the record
   */
  constructor (cb, opts={}) {
    super({ objectMode: true });

    // Initialize our options
    this.options = Object.assign({}, opts);
    this.caseFile = {};
  }

  /**
   * Required stream implementation method to write.
   *
   * @param {object} evidence - Evidence found during investigation (tracing)
   * @param {string} enc - Encoding type. Not used in object mode streams.
   * @param {function} done - Callback to fire when done filing the evidence.
   */
  _write (evidence, enc, done) {
  }
}

export default function record (cb) {
  return new Recorder(cb);
}
