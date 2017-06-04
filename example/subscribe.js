/**
 * Created by balmasi on 2017-05-30.
 */

const Bunny = require('./../index');
const loggingPlugin = require('./../lib/plugins/logging.plugin');

const bus = Bunny('consumer_two')
  .use(loggingPlugin);

function logTheTime (msg) {
  console.log(`The time was`, new Date(msg.content.when));
}

bus.subscribe('event.test.somethingHappened', logTheTime);