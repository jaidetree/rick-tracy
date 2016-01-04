import { Readable } from 'stream';

export default class Input extends Readable {
  index = 0;

  /**
   * @constructor
   * @param {array} content - Content array to push down the stream
   * @param {object} options - Readable stream initialization options
   */
  constructor (content, options={}) {
    super(Object.assign({}, {
      objectMode: true,
    }, options));

    this._content = content;
  }

  /**
   * Reads from the array at each call
   */
  _read () {
    if (this.index < this._content.length) {
      this.push(this._content[this.index]);
      this.index += 1;
    }
    else {
      this.push(null);
    }
  }
}
