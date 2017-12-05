/**
 * Created by balmasi on 2017-06-09.
 */

const bunnyhop = require('../../index');
const LocalEngine = bunnyhop.Engines.LocalEngine;
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

const options = { engine: LocalEngine, connectionManager: LocalEngine.ConnectionManager };
const serviceA_Bus = bunnyhop('test_service_1', options);
const serviceB_Bus = bunnyhop('test_service_2', options);

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
