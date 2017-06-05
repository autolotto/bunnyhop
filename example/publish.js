/**
 * Created by balmasi on 2017-06-03.
 */

const BunnyHop = require('./../index');
const { Logging, Correlator } = BunnyHop.Plugins;

const bus = BunnyHop('TestService')
  .use(Correlator)
  .use(Logging);


setInterval(
  () => {
    bus.publish(
      'event.test.somethingHappened',
      { when: Date.now() }
    )
  },
  1000
);

