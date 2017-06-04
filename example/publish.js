/**
 * Created by balmasi on 2017-06-03.
 */

const BunnyHop = require('./../index');
const log = require('./../lib/plugins/logging.plugin');

const bus = BunnyHop('TestService')
  .use(log);


setInterval(
  () => {
    bus.publish(
      'event.test.somethingHappened',
      { when: Date.now() }
    )
  },
  1000
);

