import CaseReporter from './CaseReporter';
import Investigator from './Investigator';
import EvidenceLocker from './EvidenceLocker';
import vfs from 'vinyl-fs';

/**
 * Traces a glob of files into a giant tree.
 * @param {object} opts - Options to configure the tracer
 * @param {string} opts.lineup - Entry point glob to track down.
 * @returns {Promise} A new promise that is resolved when tracing is complete
 * @todo Use that labeled stream splicer to make a more customizable workflow
 */
export default function trace (opts) {
  let options = Object.assign({
    glob: '**/*.js',
  }, opts);

  return new Promise((resolve, reject) => {
    /**
     * Returns a stream wrapped with an error handler
     * @param {stream} stream - Transform or duplex stream to wrap
     * @returns {stream} Wrapped stream
     */
    function to (stream) {
      return stream
        .on('error', (err) => reject(err));
    }

    /**
     * Find our suspects.
     * Uses vinyl-fs to gather our main entry point files.
     */
    vfs.src(options.lineup)

      /**
       * Investigate each suspect.
       * Uses our home-grown tracer stream to trace our dependencies
       */
      .pipe(to(new Investigator()))

      /**
       * Record evidence in our case file. Involves photos and red string.
       */
      .pipe(to(new EvidenceLocker()))

      /**
       * Review the casefile in a writable stream to emit the finish & end
       * events.
       */
      .pipe(to(new CaseReporter((caseFile) => {
        console.log(caseFile);
        resolve(caseFile);
      })));
  });
}
