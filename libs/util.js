var config = require('./../config')();

exports.validNick = function(nickname) {
    var regex = /^\w*$/;
    return regex.exec(nickname) !== null;
};

exports.massToRadius = function (mass) {
    return 4 + Math.sqrt(mass) * 6;
};

exports.getDistance = function (p1, p2) {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)) - p1.radius - p2.radius;
};

exports.randomInRange = function (from, to) {
    return Math.floor(Math.random() * (to - from)) + from;
};

exports.randomPosition = function (radius,width,height ) {
    return {
        x: exports.randomInRange(parseInt(radius), parseInt(width) - parseInt(radius)),
        y: exports.randomInRange(parseInt(radius), parseInt(height) - parseInt(radius))
    };
};

exports.findIndex = function(arr, id) {
    var len = arr.length;

    while (len--) {
        if (arr[len].id === id) {
            return len;
        }
    }

    return -1;
};


exports.toDegrees = function (rad) {
    return rad * (180 / Math.PI);
};

exports.toRadians = function (angle) {
    return angle * (Math.PI / 180);
};