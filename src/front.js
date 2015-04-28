var path        = require('path'),
    fs          = require('fs');

function getRealPath(filename) {
    if (filename.indexOf('..') != -1)
        return false;

    var path = __dirname + '/../front/' + filename;
    if (!fs.existsSync(path))
        return false;

    return path;
}

module.exports = {};

module.exports.returnInternalError = function (res) {
    res.writeHead(500, { 'Content-Type': 'text/html' });
    res.end(
        '<html><body>'
        + '<h1>500 Internal Server Error</h1>'
        + '<h3>An error occured</h3>'
        + '</body></html>'
    );
};

module.exports.returnNotFound = function (res) {
    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end(
        '<html><body>'
        + '<h1>404 Not Found</h1>'
        + '<h3>Requested resource was not found</h3>'
        + '</body></html>'
    );
};

module.exports.returnBadRequest = function (res) {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end(
        '<html><body>'
        + '<h1>400 Bad Request</h1>'
        + '<h3>Invalid request parameters</h3>'
        + '</body></html>'
    );
};

module.exports.returnFile = function (filename, res) {
    var realPath = getRealPath(filename);
    if (realPath === false)
        return module.exports.returnNotFound(res);

    var type = 'application/octet-stream';
    switch (path.extname(filename)) {
        case '.html':   type = 'text/html'; break;
        case '.css':    type = 'text/css'; break;
        case '.js':     type = 'application/javascript'; break;
        case '.gif':    type = 'image/gif'; break;
    }

    res.writeHead(200, { 'Content-Type': type });

    fs.readFile(realPath, function (err, data) {
        if (err)
            return return500(res);

        res.end(data);
    });
};

module.exports.parseCookies = function (req) {
    var list = {},
        rc = req.headers.cookie;

    rc && rc.split(';').forEach(function (cookie) {
        var parts = cookie.split('=');
        list[parts.shift().trim()] = decodeURI(parts.join('='));
    });

    return list;
};
