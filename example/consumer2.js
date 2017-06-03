/**
 * Created by balmasi on 2017-05-30.
 */

const Bunny = require('./../index');
// const defaultPlugin = require('./../lib/engines/default.engine');
const loggingPlugin = require('./../lib/plugins/logging.plugin');
const retry = require('./../lib/plugins/retry.plugin');


const bus = Bunny('consumer_two')
  .use(retry)
  .use(loggingPlugin)

function logMessage (msg) {
  // console.log(" [x] %s:'%s'",
  //   msg.fields.routingKey,
  //   msg.content.toString());
}

// bus.listen('cmd.order.create', 'order', logMessage);
bus.subscribe('event.test.somethingHappened', logMessage);