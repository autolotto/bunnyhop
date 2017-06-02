/**
 * Created by balmasi on 2017-05-30.
 */

const Bunny = require('./index');
const bus = Bunny('consumer_two');

function logMessage (msg) {
  // msg.ack && msg.ack();
  console.log(" [x] %s:'%s'",
    msg.fields.routingKey,
    msg.content.toString());
}

// bus.listen('cmd.order.create', 'order', logMessage);
bus.subscribe('event.order.created', logMessage);