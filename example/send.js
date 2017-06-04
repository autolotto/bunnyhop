/**
 * Created by balmasi on 2017-06-02.
 */

const BunnyHop = require('./../index');
const log = require('./../lib/plugins/logging.plugin');

const bus = BunnyHop('TestService')
  .use(log);


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