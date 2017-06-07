/**
 * Created by balmasi on 2017-06-02.
 */

const BunnyHop = require('./../index');
const { Package, Logging } = require('././plugins');

const bus = BunnyHop('TestService')
  .use(Logging)
  .use(Package);



setInterval(
  () => {
    bus.send(
      'cmd.test.doSomething',
      { when: Date.now() }
    )
      .then(r => console.log('RESULT ', r))
      .catch(e => console.error('ERROR', e))
  },
  1000
);