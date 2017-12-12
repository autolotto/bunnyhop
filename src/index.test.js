/**
 * Created by balmasi on 2017-06-09.
 */

const test = require('ava');
const td = require('testdouble');

const bunnyhop = require('./index');

test.after(() => {
  td.reset();
});

test.cb('Options - onHandlerError', t => {
  t.plan(2);
  const errorHandler = td.function();
  const listenError = new Error('Listen Error');
  const subscribeError = new Error('Subscribe Error');

  const bh = bunnyhop('ErrorHandlingService', {
    onHandlerError: errorHandler,
    engine: bunnyhop.Engines.LocalEngine,
    connectionManager: bunnyhop.Engines.LocalEngine.ConnectionManager
  });

  bh.listen('Options.Listen', () => { throw listenError; });
  bh.subscribe('Options.Subscribe', () => { throw subscribeError; });

  // try {
  bh.send('Options.Listen', {}, { sync: true }).then(() => {
    td.verify(errorHandler(listenError));
    t.pass();
  });

  bh.publish('Options.Subscribe', {});
  // Publishes cannot be synchronous so we wait for error to propagate as side effect
  setImmediate(() => {
    td.verify(errorHandler(subscribeError));
    t.pass();
    t.end();
  })
});

test.cb('Options - onHandlerSuccess', t => {
  t.plan(2);
  const successHandler = td.function();

  const bh = bunnyhop('SuccessHandlingService', {
    onHandlerSuccess: successHandler,
    engine: bunnyhop.Engines.LocalEngine,
    connectionManager: bunnyhop.Engines.LocalEngine.ConnectionManager
  });

  bh.listen('Options.Listen', () => { return 2; });
  bh.subscribe('Options.Subscribe', () => { return 3; });

  // try {
  bh.send('Options.Listen', { isListenExample: true }, { sync: true }).then(() => {
    td.verify(successHandler(2, { content: { isListenExample: true } }));
    t.pass();
  });

  bh.publish('Options.Subscribe', { isPublishExample: true });
  // Publishes cannot be synchronous so we wait for error to propagate as side effect
  setImmediate(() => {
    td.verify(successHandler(3, { content: { isPublishExample: true } }));
    t.pass();
    t.end();
  })
});