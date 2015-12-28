/**
 * Deferred is a simple way to use promises in a slightly cleaner style.
 * @extends Promise
 */
export default class Deferred extends Promise {
  /**
   * Initializes the deferred interface.
   *
   * @param {*} resolvedValue - A value to immediately resolve with.
   */
  constructor (resolvedValue) {
    super((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;

      if (resolvedValue) resolve(resolvedValue);
    });
  }

  /**
   * Generic callback function to deal with the standard callback function
   *
   * @param {*} err - Error from the resulting async function callback
   * @param {*} result - Value that gets resolved from successful async action
   * @returns {null} Returns null from either rejecting or resolving
   */
  callback (err, result) {
    if (err) return this.reject(err);
    return this.resolve(result);
  }
}
