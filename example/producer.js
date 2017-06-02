/**
 * Created by balmasi on 2017-06-02.
 */

const BunnyHop = require('./../index');
const defaultPlugin = require('./../lib/engines/default.engine');
const log = require('./../lib/plugins/logging.plugin');

const bus = BunnyHop('TestService')
  .use(defaultPlugin)
  .use(log);


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
}, 1000);