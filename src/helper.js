const urlLib = require('url'),
  encoding = require('encoding');

let helper = {
  logRawMsg: function (msg, specifier) {
    if (msg) {
      (specifier) && console.log(specifier);
      let lines = msg.split('\'');
      console.log('----');
      lines.map(function (l) {
        console.log(l);
      });
      console.log('----');
    }
  },
  getBuffer: function (txt, encoding) {
    encoding = encoding || 'utf8';
    return Buffer.from(txt, encoding);
  },
  createReqOptions: function (uri, postData) {
    return {
      method: 'POST',
      uri: uri,
      body: postData,
      headers: {
        'Content-Type': 'text/plain',
        'Content-Length': postData.length
      }
    };
  },
  createUriFromBpdUrl: function (url) {
    let u = urlLib.parse(url);
    return 'https://' + u.hostname + u.path;
  },
  responseToText: function (data) {
    let buffer64 = this.getBuffer(data, 'base64');
    return encoding.convert(buffer64, 'UTF-8', 'ISO-8859-1').toString('utf8'); // TODO: this only applies for HBCI? can we dynamically figure out the charset?
  },
  textToPostData: function (data) {
    let buffer = this.getBuffer(data);
    return buffer.toString('base64');
  },
  padWithZero: function (nr, len = 12) {
    let textToPad = String(nr);
    return '0'.repeat((len - textToPad.length)) + textToPad;
    //   var ltxt = '';
    //   var neu = len - stxt.length;
    //   for (var i = 0; i != neu; i++) {
    //     ltxt += '0';
    //   }
    //   ltxt += stxt;
    //   return ltxt;
  }
};

module.exports = helper;