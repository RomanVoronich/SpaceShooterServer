var express = require('express');
var app = express();
var path = require('path');
var http = require('http').Server(app);
var io = require('socket.io')(http);
var cookie = require('cookie');
var moment = require('moment');
var quadtree = require('./libs/quadtree');
var sat = require('sat');
var validator = require('validator');
var util = require('./libs/util');
var config = require('./config')();
//var session = require('express-session');
//var MongoStore = require('connect-mongo')(session);
//var sessionStore = new MongoStore({url:config.dbMongo});
var func = require('./func');
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', function (req, res) {
    res.render('index', {title: 'Express'});
});

var api = {status: 0, data: {}, message: ''};

app.get('/api', function (req, res) {
    api.data = {
        get_rating: {url: '/api/get_rating', description: 'get all ratind players', method: 'get'},
        get_info: {url: '/api/get_rating', description: 'get all info about player', method: 'get'},
        save_status: {url: '/api/save_status', description: 'save_status', method: 'post', params: ['player']},
        buy_skin: {url: '/api/buy_skin', description: 'buy_skin', method: 'post', params: ['player', 'skin']},
        buy_exp: {url: '/api/buy_exp', description: 'buy_exp', method: 'post', params: ['player', 'exp']},
        buy_currency: {
            url: '/api/buy_currency',
            description: 'buy_currency',
            method: 'post',
            params: ['player', 'currency']
        },
        buy_bullet: {url: '/api/buy_bullet', description: 'buy_bullet', method: 'post', params: ['player', 'bullet']},
        buy_speed_exp: {
            url: '/api/buy_speed_exp',
            description: 'buy_speed_exp',
            method: 'post',
            params: ['player', 'speed_exp']
        }
    };
    res.send(api);
});
app.get('/api/get_rating', function (req, res, next) {
    func.getRating({}, function (err, result) {
        if (err) {
            api.message = err;
        } else {
            api.status = 1;
            api.data = result;
        }
        res.send(api);
    })
});
app.get('/api/player_info', function (req, res) {
    if (req.query && req.query.player_id) {
        var player_id = (validator.isAlphanumeric(req.query.player_id)) ? (req.query.player_id) : ('')
        func.playerInfo({player_id: player_id}, function (err, result) {
            if (err) {
                api.message = err;
            } else {
                api.status = 1;
                api.data = result;
            }
            res.send(api);
        })

    } else {
        api.message = 'not player_id';
        res.send(api);
    }

});
app.post('/api/buy_skin', function (req, res) {
    func.getInfo({player_id: 1}, function (err, result) {
        if (err) {
            api.message = err;
        } else {
            api.status = 1;
            api.data = result;
        }
        res.send(api);
    })
});
// TODO дописать покупки
app.post('/api/buy_exp', function (req, res) {
    res.send(api);
});

app.post('/api/buy_currency', function (req, res) {
    res.send(api);
});

app.post('/api/buy_bullet', function (req, res) {
    res.send(api);
});

app.post('/api/buy_speed_exp', function (req, res) {
    res.send(api);
});

var args = {x: 0, y: 0, h: config.game.height, w: config.game.width};
var tree = quadtree.QUAD.init(args);

var maps = {
    1: {name: 'map_1.tmx', width: 3130, height: 2650},
    2: {name: 'map_2.tmx', width: 5000, height: 5000},
    3: {name: 'map_3.tmx', width: 5000, height: 5000},
    4: {name: 'map_4.tmx', width: 5000, height: 5000},
    5: {name: 'map_5.tmx', width: 5000, height: 5000}
};

var players = {};
var playersUpdate = {};
var playerConfig = {
    life: config.game.player.life,
    radius: config.game.player.radius,
    speed: config.game.player.speed,
    speedRotation: config.game.player.speed
};
var bullets = {};
var bulletConfig = {
    speed: config.game.bullet.speed,
    power: config.game.bullet.power,
    life: config.game.bullet.life
};
var deadPlayers = {};
var deadBullets = {};
var sockets = {};
var leaderboard = [];
var leaderboardChanged = false;
var V = sat.Vector;
var C = sat.Circle;

/*
 var cometConfig = {
 life: 150,
 speed: 10,
 radius: 10,
 x: 0,
 y: 0,
 angle: -2.5
 }
 var comet = {};
 */

/*
 пересчет координат начала выстрела
 */
function addBullet(bullet) {
    var angle = (bullet.angle - 0.3);
    var y = bullet.y + 80 * Math.sin(angle);
    var x = bullet.x + 80 * Math.cos(angle);
    var rand = ((new Date()).getTime() + '-' + Math.floor(Math.random() * 100000));
    bullets[rand] = {
        id: rand,
        x: /*bullet.*/x,
        y: /*bullet.*/y,
        playerId: bullet.playerId,
        angle: bullet.angle,
        speed: bulletConfig.speed,
        power: bulletConfig.power,
        life: bulletConfig.life
    };
}
/*
 function addComet(){
 comet = Object.assign({},{id:((new Date()).getTime() + '' + Math.floor(Math.random()*1000)) >>> 0}, cometConfig);

 }
 */
/*
 function moveComet(){
 if (Object.getOwnPropertyNames(comet).length > 0) {
 var deltaY = comet.speed * Math.sin(-comet.angle);
 var deltaX = comet.speed * Math.cos(comet.angle);
 if (!isNaN(deltaY)) {
 comet.y += deltaY;
 }
 if (!isNaN(deltaX)) {
 comet.x -= deltaX;
 }
 comet.life-=1;
 if (comet.life<=-1) {
 comet = {};
 }
 }
 }
 */

function movePlayer(player) {
    if (player && player.target) {
        var target = {
            angle: player.target.angle,
            speed: player.target.speed,
            rotation: player.target.rotation,
            rotationSpeed: player.target.rotationSpeed
        };
        var deltaY = target.speed * playerConfig.speed * Math.sin(target.angle);
        var deltaX = target.speed * playerConfig.speed * Math.cos(target.angle);

        if (!isNaN(deltaY)) {
            player.y += deltaY;
        }

        if (!isNaN(deltaX)) {
            player.x += deltaX;
        }

        if (!isNaN(target.rotation)) {
            player.r = target.rotation;//((target.rotationSpeed==0)?(player.r):(target.rotation));
        }

        var borderCalc = player.radius / 3;
        if (player.x > maps[player.map].width - borderCalc) {
            player.x = maps[player.map].width - borderCalc;
        }
        if (player.y > maps[player.map].height - borderCalc) {
            player.y = maps[player.map].height - borderCalc;
        }
        if (player.x < borderCalc) {
            player.x = borderCalc;
        }
        if (player.y < borderCalc) {
            player.y = borderCalc;
        }
    }
}

// движения игроков
function moveloop() {
    Object.keys(players).forEach(function (k) {
        if (players[k].life > 0) {
            tickPlayer(players[k]);
        } else {
            deadPlayers[k] = players[k];
            delete players[k]
        }
    });
    //  выстрелы
    Object.keys(bullets).forEach(function (k) {
        if (bullets[k].life > 0) {
            moveBullet(bullets[k]);
        } else {
            // удалим
            deadBullets[k] = bullets[k];
            delete bullets[k];
        }
    });
    // пускаем кометы
    // moveComet();
    // вычисляем попадания
    calcCollision();
}

function tickPlayer(currentPlayer) {
    // если время жизни истекло или жизни закончились у игрока
    if (currentPlayer.lastHeartbeat < new Date().getTime() - config.game.maxHeartbeatInterval) {
        sockets[currentPlayer.id].emit('playerKick', {
            status: 0,
            data: {},
            message: 'Last heartbeat received over ' + config.game.maxHeartbeatInterval + ' ago.'
        });
        sockets[currentPlayer.id].disconnect();
    }
    movePlayer(currentPlayer);
}

function moveBullet(curBullet) {
    if (curBullet.life > 0) {
        var target = {
            angle: curBullet.angle,
            speed: curBullet.speed,
            life: curBullet.life,
            power: curBullet.power
        };
        var deltaY = target.speed * Math.sin(target.angle);
        var deltaX = target.speed * Math.cos(target.angle);
        if (!isNaN(deltaY)) {
            curBullet.y += deltaY;
        }
        if (!isNaN(deltaX)) {
            curBullet.x += deltaX;
        }
        curBullet.life--;
    }
}

function calcCollision() {
    Object.keys(players).forEach(function (p) {
        Object.keys(bullets).forEach(function (b) {
            if (inCircle(players[p], bullets[b])) {
                // если пуля и игрок живы
                if (bullets[b].life > 0 && bullets[b].playerId != players[p].id && players[p].life > 0) {
                    // уменьшаем кол-во жизней игрока, в которого она попала
                    players[p].life -= bullets[b].power;
                    // убиваем пулю
                    bullets[b].life = 0;
                    // производим различные расчеты - убит - убил
                    if (players[p].life <= 0) {
                        p.life = 0;
                        if (!playersUpdate[p]) {
                            playersUpdate[p] = {}
                        }
                        players[p].count_dead += 1;
                        playersUpdate[p] = Object.assign(playersUpdate[p], players[p]);
                        if (!playersUpdate[bullets[b].playerId]) {
                            playersUpdate[bullets[b].playerId] = {}
                        }
                        // если кто убил - пока не умер или не отключился
                        if (players[bullets[b].playerId]) {
                            players[bullets[b].playerId].life = playerConfig.life;
                            players[bullets[b].playerId].score += 1;
                            playersUpdate[bullets[b].playerId] = Object.assign(playersUpdate[bullets[b].playerId], players[bullets[b].playerId])
                        }
                    }
                }
            }
        })
    })
}

function inCircle(player, bullet) {
    return Math.pow((player.x - bullet.x), 2) + Math.pow((player.y - bullet.y), 2) <= Math.pow(playerConfig.radius, 2);
}

function sendUpdates() {
    Object.keys(players).forEach(function (u) {
        u.x = u.x || config.game.width / 2;
        u.y = u.y || config.game.height / 2;
        var visiblePlayers = [];
        var visibleBullets = [];
        Object.keys(players).forEach(function (f) {
            visiblePlayers.push(players[f]);
        });
        Object.keys(bullets).forEach(function (f) {
            visibleBullets.push(bullets[f]);
        });
        sockets[u].emit('serverPlay', visiblePlayers, visibleBullets);

        if (Object.keys(deadBullets).length > 0 || Object.keys(deadPlayers).length > 0) {
            var arrDeadPlayers = [];
            var arrDeadBullets = [];
            Object.keys(deadPlayers).forEach(function (f) {
                arrDeadPlayers.push(deadPlayers[f]);
            });
            Object.keys(deadBullets).forEach(function (f) {
                arrDeadBullets.push(deadBullets[f]);
            });
            sockets[u].emit('deadPlayers', arrDeadPlayers, arrDeadBullets);
        }
    });
    deadPlayers = {};
    deadBullets = {};
}


function updatePlayerStatistic() {
    Object.keys(playersUpdate).forEach(function (k) {
        func.saveStatus(playersUpdate[k], function (err, result) {
            if (err) {
                console.error('[ERROR] playersUpdate', err)
            }
            console.info('playersUpdate', result);
            if (result && result.status && result.status == 1) {
                delete playersUpdate[result.player_id]
            }
        })
    })
}

io.on('connection', function (socket) {
    var query = {};
    console.info('connection  query:', JSON.parse(socket.handshake.query.player));
    try {
        query = JSON.parse(socket.handshake.query.player);

    } catch (e) {
        console.error('connection ', e);
    }

    func.playerInfo({player_id: query.id}, function (err, resultPlayer) {
        if (err) {
            // TODO дисконнектить юзверя=
            console.error('func.playerInfo', err)
        }
        var position = util.randomPosition(playerConfig.radius, query.screenWidth, query.screenHeight);
        var currentPlayer = {
            id: query.id,
            x: position.x,
            y: position.y,
            r: 0,
            name: (resultPlayer.nickname) ? (resultPlayer.nickname) : (query.name),
            life: playerConfig.life,
            level: resultPlayer.level,
            score: resultPlayer.score,
            count_dead: resultPlayer.count_dead,
            map: 1,
            lastHeartbeat: new Date().getTime(),
            target: {angle: 0, speed: 0, rotation: 0},
            radius: playerConfig.radius,
            screenWidth: query.screenWidth,
            screenHeight: query.screenHeight
        };
        console.info('Player ' + currentPlayer.name + ' connecting...');

        // проверка на существование игрока в нашем объекте
        if (!players[currentPlayer.id]) {
            if (util.validNick(currentPlayer.name)) {
                console.info('Player ' + currentPlayer.name + ' connected!');
                sockets[currentPlayer.id] = socket;
                players[currentPlayer.id] = currentPlayer;
                socket.broadcast.emit('playerJoin', currentPlayer);
                console.info('socket.emit.gameSetup', currentPlayer);
                socket.emit('gameSetup', Object.assign({}, {
                    gameWidth: config.game.width,
                    gameHeight: config.game.height
                }, currentPlayer));
                console.info('Total players: ' + Object.keys(players).length);
            } else {
                console.info('Player ' + currentPlayer.id + ' kick!');
                socket.emit('playerKick', {status: 0, data: {}, message: 'Player kick! Not valid name!'});
                socket.disconnect();
            }
        } else {
            console.info('Player ID is already connected, kicking.');
            socket.emit('playerKick', {status: 0, data: {}, message: 'Player ID is already connected.'});
            socket.disconnect();
        }

        socket.on('ping', function () {
            console.info('ping');
            socket.emit('pong');
        });

        socket.on('disconnect', function () {
            socket.broadcast.emit('playerDisconnect', {id: currentPlayer.id});
            socket.disconnect();
            // добавляем после дисконнекта в обновление игроков
            playersUpdate[currentPlayer.id] = players[currentPlayer.id];
            if (players[currentPlayer.id]) {
                delete players[currentPlayer.id]
            }
            console.info('User ' + currentPlayer.id + ' disconnected!');
            console.info('Total players: ' + Object.keys(players).length);

        });

        socket.on('0', function (target) {
            try {
                currentPlayer.lastHeartbeat = new Date().getTime();
                currentPlayer.target = JSON.parse(target);
            } catch (e) {
                console.error('socket.on(0)', e)
            }
        });

        socket.on('fire', function (bullet) {
            addBullet(JSON.parse(bullet))
        })
    })
})

setInterval(moveloop, 1000 / config.game.fps);
setInterval(sendUpdates, 1000 / config.game.fps);
setInterval(updatePlayerStatistic, config.game.updatePLayerStatistic);
//setInterval(addComet, 5000);

http.listen(config.port, function () {
    console.info('listening on http://localhost:3000');
});
