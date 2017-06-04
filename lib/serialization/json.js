/**
 * Created by balmasi on 2017-06-03.
 */

module.exports = {
  serialize: content => new Buffer(JSON.stringify(content)),
  deserialize: buffer => JSON.parse(buffer.toString())
};