import investigate from './investigate';
import record from './record';
import vfs from 'vinyl-fs';

/**
 * Traces a glob of files into a giant tree.
 * @param {object} opts - Options to configure the tracer
 * @param {string} opts.globh - Glob of entry point files to trace down.
 * @returns {Promise} A new promise that is resolved when tracing is complete
 */
export default function trace (opts) {
  let options = Object.assign({
    glob: '**/*.js',
  }, opts);

  return new Promise((resolve, reject) => {
    let caseFile = {};

    /**
     * Returns a stream wrapped with an error handler
     * @param {stream} stream - Transform or duplex stream to wrap
     * @returns {stream} Wrapped stream
     */
    function then (stream) {
      return stream
        .on('error', (err) => reject(err));
    }

    /**
     * Find our suspects.
     * Uses vinyl-fs to gather our main entry point files.
     */
    vfs.src(options.glob)

      /**
       * Investigate each suspect.
       * Uses our home-grown tracer stream to trace our dependencies
       */
      .pipe(then(investigate()))

      /**
       * Record evidence in our case file. Involves photos and red string.
       * Uses a writable stream
       */
      .pipe(then(record((evidence) => {
        Object.assign(caseFile, evidence);
      })))

      /**
       * Finally publish our caseFile
       */
      .on('finish', () => resolve(caseFile));
  });
}
