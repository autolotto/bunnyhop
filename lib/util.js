/**
 * Created by balmasi on 2017-05-31.
 */
/**
 * Converts arrays to keymaps
 *
 * @param array
 * @return {object}
 * @example
 * toKeymap(['sendCmd', 'be--Well'])
 * // returns { SEND_CMD: 'sendCmd', BE_WELL: 'be--Well' }
 *
 */
function toKeymap (array = []) {
  return array.reduce((acc = {}, key) =>
      Object.assign({ [_.snakeCase(key).toUpperCase()]: key }, acc)
  , {});
}

module.exports = {
  toKeymap
};