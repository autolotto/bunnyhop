/**
 * Created by balmasi on 2017-06-09.
 */

const bunnyhop = require('../../index');
const Promise = require('bluebird');
const test = require('ava');
const td = require('testdouble');

const { TimeoutError } = require('../util');

test.after(() => {
  td.reset();
});

/*

  __  ______  ______         __   __ __ ______ ______  __
 (( \||   ||\ |||| \\   |    ||   ||(( \| || |||   ||\ ||
  \\ ||== ||\\||||  ))  |    ||   || \\   ||  ||== ||\\||
 \_))||___|| \||||_//   |    ||__|||\_))  ||  ||___|| \||

 */

const serviceA_Bus = bunnyhop('test_service_1');
const serviceB_Bus = bunnyhop('test_service_2');

test('listen - Should throw an error if the listen routingKey has a * or #', async t => {
    const errorStar = await t.throws(serviceA_Bus.listen('*', td.function()));
    const errorHash = await t.throws(serviceA_Bus.listen('*', td.function()));
    t.true(
      errorHash.message === errorStar.message
      && errorHash.message === 'Routing key cannot contain * or # for "listen".'
    )
});


test('send/listen - should round-robin between listeners on the same routing key', async t => {
  const listenFn1 = td.function('consumer 1');
  const listenFn2 = td.function('consumer 2');
  await serviceA_Bus.listen('A.B.A', listenFn1);
  await serviceA_Bus.listen('A.B.A', listenFn2);

  await serviceA_Bus.send('A.B.A', { yo: 'OI!' });
  await serviceA_Bus.send('A.B.A', { yo: 'OI!' });
  await serviceA_Bus.send('A.B.A', { yo: 'OI!' });
  await serviceA_Bus.send('A.B.A', { yo: 'OI!' });
  await serviceA_Bus.send('A.B.A', { yo: 'OI!' });
  await serviceA_Bus.send('A.B.A', { yo: 'OI!' });
  await serviceA_Bus.send('A.B.A', { yo: 'OI!' });
  await serviceA_Bus.send('A.B.A', { yo: 'OI!' });
  await serviceA_Bus.send('A.B.A', { yo: 'OI!' });
  await serviceA_Bus.send('A.B.A', { yo: 'OI!' });

  await Promise.delay(500);
  const listen1Calls = td.explain(listenFn1).callCount;
  const listen2Calls = td.explain(listenFn2).callCount;

  t.true(listen1Calls > 4);
  t.true(listen2Calls > 4);
});

test(`send/listen - with { sync: true } options, should RPC and return promise that resolves into the listener's return value.`,
  async t => {
    async function listenFn (msg) {
      const { content: { hello } } = msg;
      return `${hello} world`;
    }
    await serviceA_Bus.listen('A.B.B', listenFn);
    const response = await serviceA_Bus.send('A.B.B', { hello: `it's a mad, mad` }, { sync: true });
    t.is(response, `it's a mad, mad world`);
  }
);


test(`send/listen - with { sync: true } options, should RPC and return a promise that rejects if the listener throws an error.`,
  async t => {
    async function listenFn () {
      throw new Error('Sorry, the world just ended.')
    }
    await serviceA_Bus.listen('A.B.C', listenFn);
    const error = await t.throws(serviceA_Bus.send('A.B.C', { hello: `it's a mad, mad` }, { sync: true }));
    t.is(error.message, 'Sorry, the world just ended.');
  }
);


test('send/listen - with { timeoutMs: N, sync: true } should reject if the response times out', async t => {
  const listenFn = async ({ content: { resolveInMs } }) => {
    await Promise.delay(resolveInMs);
    return 'SUCCESS';
  };

  await serviceA_Bus.listen('T.I.M.E', listenFn);
  const answer = await serviceA_Bus.send('T.I.M.E', { data: 'wow', resolveInMs: 100 }, { sync: true, timeoutMs: 150 });
  t.is(answer, 'SUCCESS');

  await t.throws(
    serviceA_Bus.send('T.I.M.E', { resolveInMs: 100 }, { sync: true, timeoutMs: 50 }),
    TimeoutError,
    'Should reject with a TimeoutError if RPC listener does not respond within timeoutMs'
  );

  await t.notThrows(
    serviceA_Bus.send('T.I.M.E', { resolveInMs: 100 }, { timeoutMs: 50 }),
    'Should ignore time out if { sync: true } option is not set'
  );
});

/*
 ____ __ ______        __ __ ______
 || \\|| |||| ))      (( \|| |||| ))
 ||_//|| ||||=)        \\ || ||||=)
 ||   \\_//||_))      \_))\\_//||_))

 */


test('publish/subscribe - Only one subscriber should get the message per service', async t => {
  const serviceA_subscribe1 = td.function();
  const serviceA_subscribe2 = td.function();

  const serviceB_subscribe1 = td.function();
  const serviceB_subscribe2 = td.function();

  await Promise.all([
    serviceB_Bus.subscribe('Z.Y.*', serviceA_subscribe1),
    serviceB_Bus.subscribe('Z.Y.*', serviceA_subscribe2),

    serviceA_Bus.subscribe('Z.Y.X', serviceB_subscribe1),
    serviceA_Bus.subscribe('Z.Y.X', serviceB_subscribe1),
  ]);



  await serviceA_Bus.publish('Z.Y.X', { hi: 'there' });
  await Promise.delay(1000);

  const totalServiceAInvocations =
    td.explain(serviceA_subscribe1).callCount +
    td.explain(serviceA_subscribe2).callCount;

  const totalServiceBInvocations =
    td.explain(serviceB_subscribe1).callCount +
    td.explain(serviceB_subscribe2).callCount;

  t.is(totalServiceAInvocations, 1);
  t.is(totalServiceBInvocations, 1);
});