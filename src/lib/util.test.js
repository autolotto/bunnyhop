const test = require('ava');

const { getRejectedPromiseIfTimedOut, TimeoutError } = require('./util');

test('#getRejectedPromiseIfTimedOut - Should reject a promise after given milliseconds', async t => {
  const before = Date.now();
  await t.throws(getRejectedPromiseIfTimedOut(500), TimeoutError);
  t.true(Date.now() - before - 500 < 20);
});