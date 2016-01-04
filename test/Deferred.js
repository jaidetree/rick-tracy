import expect from 'expect';

import Deferred from '../src/Deferred';

describe('Deferred', () => {
  describe('#constructor()', () => {
    it('Should have 3 methods', () => {
      let deferred = new Deferred();

      expect(deferred).toBeA(Deferred);
      expect(deferred.resolve).toBeA(Function);
      expect(deferred.reject).toBeA(Function);
      expect(deferred.promise).toBeA(Function);
    });
  });

  describe('#promise()', () => {
    it('Should return a promise', () => {
      let deferred = new Deferred();

      expect(deferred.promise()).toBeA(Promise);
    });
  });

  describe('#resolve()', () => {
    it('Should resolve a promise', () => {
      let spy = expect.createSpy().andCall((val) => {
            return val;
          }),
          deferred = new Deferred();

      deferred.resolve(7);

      deferred
        .promise()
        .then(spy)
        .then((result) => {
          expect(spy).toHaveBeenCalled();
          expect(result).toBe(7);
        });
    });
  });

  describe('#reject()', () => {
    it('Should resolve a promise', () => {
      let spy = expect.createSpy().andCall((val) => {
            return val;
          }),
          deferred = new Deferred();

      deferred.reject(7);

      deferred
        .promise()
        .then(spy)
        .catch((result) => {
          expect(spy).toHaveBeenCalled();
          expect(result).toBe(7);
        });
    });
  });
});
