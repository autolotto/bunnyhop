/**
 * Created by balmasi on 2017-05-30.
 */

const Bunny = require('./index');
const bus = Bunny('producer');

let count = 0;

// setInterval(function () {
//   count++;
//   bus.send('cmd.order.create', { my: 'data' + count });
// }, 0);

setInterval(function () {
  count++;
  bus.publish('event.order.created', { my: 'data' + count });
}, 2000);