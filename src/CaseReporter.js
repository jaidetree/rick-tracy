import { Writable } from 'stream';

export default class CaseReporter extends Writable {

  /**
   * Initializes the writable stream
   *
   * @param {function} cb - Callback to fire with the final case file
   */
  constructor (cb) {
    super({ objectMode: true });
    this.cb = cb;
  }

  /**
   * Required implementation for writable streams
   *
   * @param {object} caseFile - The whole dependency tree
   * @param {string} enc - Not used in object mode streams.
   * @param {function} done - Callback to fire when finished writing the tree.
   */
  _write (caseFile, enc, done) {
    this.cb(caseFile);

    done(null, caseFile);
  }
}
