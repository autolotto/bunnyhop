/**
 * Created by balmasi on 2017-05-30.
 */

const Bunny = require('./../index');
const loggingPlugin = require('./../lib/plugins/logging.plugin');

const bus = Bunny('consumer_one')
  .use(loggingPlugin);

function doSomething (msg) {
  return new Promise((resolve, reject) => {
    setTimeout(function () {
      // After some heavy deliberation
      resolve({ wow: true});
      /* Or something went wrong */
      // reject(new Error('This is no good'));
    }, 2000);
  });
}

bus.listen('cmd.test.doSomething', doSomething);