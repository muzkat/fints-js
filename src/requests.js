const rp = require('request-promise-native');

let requests = {
    post : function (options) {
      return rp(options);
    }
};

module.exports = requests;