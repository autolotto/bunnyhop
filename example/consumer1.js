/**
 * Created by balmasi on 2017-05-30.
 */

const Bunny = require('./../index');
// const defaultPlugin = require('./../lib/engines/default.engine');
const loggingPlugin = require('./../lib/plugins/logging.plugin');
const retry = require('./../lib/plugins/retry.plugin');

const bus = Bunny('consumer_one')
  .use(retry)
  .use(loggingPlugin);

function doSomething (msg) {
  setTimeout(function () {
    // DO something difficult
    msg.ack && msg.ack();
  }, 200);
  // console.log(" [x] %s:'%s'",
  //   msg.fields.routingKey,
  //   msg.content.toString());
}

bus.listen('cmd.test.doSomething', doSomething);
// bus.subscribe('event.order.created', logMessage);