'use strict'

var sprintf = require("sprintf-js").sprintf;

function Table(serviceLocator) {
    this.sl = serviceLocator;

    this.sl.set('table', this);
};

module.exports = Table;

Table.prototype.print = function (header, rows) {
    if (header.length == 0)
        return;

    var widths = [], line = "";
    for (var i = 0; i < header.length; i++) {
        var columnWidth = header[i].length;
        rows.forEach(function (el) {
            if (el[i] && el[i].length > columnWidth)
                columnWidth = el[i].length;
        });
        widths.push(columnWidth);

        line += sprintf('%-' + (columnWidth + 2) + 's', " " + header[i]);
        line += (i == header.length - 1 ? "" : "|");
    }
    console.log(line);

    line = "";
    for (var i = 0; i < header.length; i++) {
        for (var j = 0; j < widths[i] + 2; j++)
            line += '-';
        line += (i == header.length - 1 ? "" : "+");
    }
    console.log(line);

    for (var i = 0; i < rows.length; i++) {
        line = "";
        for (var j = 0; j < rows[i].length; j++) {
            line += sprintf('%-' + (widths[j] + 2) + 's', " " + rows[i][j]);
            line += (j == rows[i].length - 1 ? "" : "|");
        }
        console.log(line);
    }
};
