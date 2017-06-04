/**
 * Created by balmasi on 2017-05-30.
 */

const BunnyHop = require('./../index');
const loggingPlugin = require('./../lib/plugins/logging.plugin');

const bus = BunnyHop('consumer_one')
  .use(loggingPlugin);

function doSomething (msg) {
  return new Promise((resolve, reject) => {
    setTimeout(function () {
      console.log('Doing some hard work for 2 seconds...');
      // After some heavy deliberation
      resolve({
        answer: `The time the message was created was ${new Date(msg.content.when)}`
      });
      /* Or something went wrong */
      // reject(new Error('This is no good'));
    }, 2000);
  });
}

bus.listen('cmd.test.doSomething', doSomething);