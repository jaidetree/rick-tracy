import expect from 'expect';
import Input from './lib/Input';
import CaseReporter from '../src/CaseReporter';

import { Writable } from 'stream';

describe('CaseReporter', () => {
  describe('#constructor()', () => {
    it('Should be a stream', () => {
      let reporter = new CaseReporter();

      expect(reporter).toBeA(Writable);
      expect(reporter._writableState.objectMode).toBe(true);
    });
  });

  describe('#write()', () => {
    it('Should call a callback when content is written to it', (done) => {
      let input = new Input(['hello world']),
          spy = expect.createSpy(),
          reporter = new CaseReporter(spy);

      spy.andCall((data) => {
        expect(spy).toHaveBeenCalled();
        expect(data).toBe('hello world');
        done();
      });

      input.pipe(reporter);
    });
  });
});
