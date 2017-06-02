/**
 * Created by balmasi on 2017-05-30.
 */

const Bunny = require('./../index');
const defaultPlugin = require('./../lib/engines/default.engine');
const loggingPlugin = require('./../lib/plugins/logging.plugin');

const bus = Bunny('consumer_two')
  .use(defaultPlugin)
  .use(loggingPlugin)

function logMessage (msg) {
  // msg.ack && msg.ack();
  console.log(" [x] %s:'%s'",
    msg.fields.routingKey,
    msg.content.toString());
}

// bus.listen('cmd.order.create', 'order', logMessage);
bus.subscribe('event.test.somethingHappened', logMessage);