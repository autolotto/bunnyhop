/**
 * Created by balmasi on 2017-06-02.
 */

const ON_DEATH = require('death');
const BunnyHop = require('../index');
const { Package, Logging } = BunnyHop.Plugins;

const bus = BunnyHop('TestService')
  .use(Logging)
  // .use(Package);

setInterval(
  () => {
    bus.send(
      'cmd.test.doSomething',
      { when: Date.now() },
      {
        // sync: true, // adds 'x-isRPC': true to header. (resolves returned promise with answer or rejects with error)
        // correlationId: 'customCorId', // Provide custom correlationId
        // type: 'arbitraryType' // custom msg.properties.type
      }
    )
      .then(r => console.log('RESULT ', r))
      .catch(e => console.error('ERROR', e))
  },
  4000
);

ON_DEATH(() => {
  process.nextTick(() => process.exit(0))
});