/**
 * Created by balmasi on 2017-05-30.
 */

const BunnyHop = require('./../index');
const { Logging, Correlator } = BunnyHop.Plugins;

const bus = BunnyHop('consumer_two')
  .use(Logging)
  .use(Correlator);

function logTheTime (msg) {
  console.log(`${msg.properties.correlationId} The time was`, new Date(msg.content.when));
}

bus.subscribe('event.test.somethingHappened', logTheTime);