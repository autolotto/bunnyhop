/**
 * Created by balmasi on 2017-06-02.
 */

const BunnyHop = require('./../index');
const defaultEngine = require('./../lib/engines/default.engine');
const log = require('./../lib/plugins/logging.plugin');
const retry = require('./../lib/plugins/retry.plugin');

const bus = BunnyHop('TestService')
  .use(retry)
  .use(log)
  .engine(defaultEngine);


let pub = true;
setInterval(() => {
  if (pub) {
    bus.publish(
      'event.test.somethingHappened',
      { when: `${Date.now()}` }
    )
  } else {
    bus.send(
      'cmd.test.doSomething',
      { some: 'thing ' + Date.now() }
    )
  }
  pub = !pub;
}, 100);