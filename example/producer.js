/**
 * Created by balmasi on 2017-06-02.
 */

const BunnyHop = require('./../index');
const log = require('./../lib/plugins/logging.plugin');

const bus = BunnyHop('TestService')
  .use(log);


let pub = false;
// setInterval(() => {
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
      .then(r => console.log('RESULT ', r))
      .catch(e => console.error('ERROR', e))
  }
//   // pub = !pub;
// }, 5000);