const test = require('ava');
const td = require('testdouble');

const { getRejectedPromiseIfTimedOut, TimeoutError, wrapCompletedHandlers } = require('./util');

test.beforeEach(() => td.reset());

test('#getRejectedPromiseIfTimedOut - Should reject a promise after given milliseconds', async t => {
  const before = Date.now();
  await t.throws(getRejectedPromiseIfTimedOut(500), TimeoutError);
  t.true(Date.now() - before - 500 < 20);
});

const w = wrapCompletedHandlers;
test('#wrapCompletedHandlers - synchronous functions', t => {
  const onSuccess = td.function('onSuccess');
  const onError = td.function('onError');
  const syncFunction = (a, b) => a + b;
  const syncFunctionThrows = () => {
    throw new Error('sync error');
  };

  t.is(w(syncFunction)(1,2), 3, 'should still return original value');
  t.throws(w(syncFunctionThrows), Error, 'sync error', 'should throw synchronous error');

  w(syncFunction, onError)(1,2);
  // Should not call handlers if non is provided
  td.verify(onSuccess(), { ignoreExtraArgs: true, times: 0 });
  td.verify(onError(), { ignoreExtraArgs: true, times: 0 });

  // should call onSuccessHandler if provided
  w(syncFunction, null, onSuccess)(1,2);
  td.verify(onSuccess(3, 1, 2));

  // should still return result even though there's a success handler
  t.is(w(syncFunction, onError, onSuccess)(3,4), 7);
  td.verify(onSuccess(7, 3, 4));

  // Should not throw error if there's an error handler
  t.notThrows(w(syncFunctionThrows, onError, onSuccess));
  td.verify(onError(new Error('sync error')));
});

test('#wrapCompletedHandlers - async functions', async t => {
  const asyncFunction = (a, b) => Promise.resolve(a + b);
  const asyncFunctionRejects = (a, b) => Promise.reject(
    new Error('async rejection')
  );
  const onSuccess = td.function('onSuccess');
  const onError = td.function('onError');

  t.is(await w(asyncFunction)(1,2), 3, 'should still return original value');

  await t.throws(
    w(asyncFunctionRejects)()
  );

  await w(asyncFunction, onError)(1,2);
  td.verify(onSuccess(), { ignoreExtraArgs: true, times: 0 });
  td.verify(onError(), { ignoreExtraArgs: true, times: 0 });

  await w(asyncFunction, null, onSuccess)(1,2);
  td.verify(onSuccess(3, 1, 2));

  await t.notThrows(w(asyncFunctionRejects, onError)());

  t.is(await w(asyncFunction, onError, onSuccess)(3,4), 7);
  td.verify(onSuccess(7, 3, 4));
});