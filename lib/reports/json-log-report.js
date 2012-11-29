var fs = require('fs');

var JsonLogReport = function (file) {
    this._stream = fs.createWriteStream(file);
    this._stream.write('[');
    this._first = true;
};

JsonLogReport.prototype = {};

JsonLogReport.prototype.addResult = function (event) {
    var value = JSON.stringify(event);
    if (this._first) {
        this._first = false;
    } else {
        this._stream.write(',\n');
    }
    this._stream.write(value);
    if (event.event == "campaignFinished") {
        this._stream.end(']');
        this._stream.destroySoon();
        this._stream = null;
    }
};

module.exports = JsonLogReport;