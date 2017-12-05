const test = require('ava');
const Bluebird = require('bluebird');

const Bunnyhop = require('../../index');
const TimeoutPlugin = require('./timeout.plugin');
const { getRejectedPromiseIfTimedOut, TimeoutError } = require('./timeout.plugin.helper');

const bh = Bunnyhop('timeout_test', { engine: Bunnyhop.Engines.LocalEngine })
  .use(TimeoutPlugin);

test('#getRejectedPromiseIfTimedOut - Should reject a promise after given milliseconds', async t => {
  const before = Date.now();
  await t.throws(getRejectedPromiseIfTimedOut(500), TimeoutError);
  t.true(Date.now() - before - 500 < 20);
});


test('timeouts - should timeout with sync and timeoutMs options set in send options', async t => {
  const listenFn = async (msg) => {
    await Bluebird.delay(20);
    return 'result';
  };

  bh.listen('A.B.C', listenFn);
  const result = await bh.send('A.B.C', { input: '1' }, { sync: true });
  t.is(result, 'result', 'should not ruin default sync behaviour.');

  t.is(
    await bh.send('A.B.C', { input: '1' }, { sync: true, timeoutMs: 30 }),
    'result',
    'should return result if result returns before timeout'
  );

  await t.throws(
    bh.send('A.B.C', { data: 'data' }, { sync: true, timeoutMs: 10 }),
    TimeoutError,
    'Operation Timed Out.',
    'should time out if timeout is less than time to result.'
  );

  await t.notThrows(
    bh.send('A.B.C', { data: 'data' }, { timeoutMs: 10 }),
    'should NOT time out if sync option is not true regardless of timeoutMs option.'
  )
});