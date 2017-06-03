/**
 * Created by balmasi on 2017-05-30.
 */

const Bunny = require('./../index');
const loggingPlugin = require('./../lib/plugins/logging.plugin');


const bus = Bunny('consumer_two')
  .use(loggingPlugin)

function logMessage (msg) {
  // console.log(" [x] %s:'%s'",
  //   msg.fields.routingKey,
  //   msg.content.toString());
}

bus.subscribe('event.test.somethingHappened', logMessage);