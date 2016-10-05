var Sequelize = require('sequelize');
var async = require('async');
var config = require('../config')();
var sequelize = new Sequelize(
    config.dbMysql.database,
    config.dbMysql.username,
    config.dbMysql.password,
    {
        host: config.dbMysql.host,
        dialect: config.dbMysql.dialect
    }
);
var opts = {
    timestamps: true,
    freezeTableName: true
};
var player_define = {
    name: 'players',
    fields: {
        nickname: {type: Sequelize.STRING},
        g_id: {type: Sequelize.STRING, unique: true},
        fb_id: {type: Sequelize.STRING, unique: true},
        vk_id: {type: Sequelize.STRING, unique: true},
        player_id: {type: Sequelize.STRING, unique: true},
        level: {type: Sequelize.INTEGER, allowNull: false, defaultValue: 1},
        score: {type: Sequelize.INTEGER, allowNull: false, defaultValue: 0},
        count_dead: {type: Sequelize.INTEGER, allowNull: false, defaultValue: 0}
    }
};
var bays_define = {
    name: 'bays',
    fields: {
        name: {type: Sequelize.STRING, unique: true},
        type: {type: Sequelize.STRING},
        price: {type: Sequelize.INTEGER},
        best_before: {type: Sequelize.INTEGER}, // minute   0-infinity
        status: {type: Sequelize.INTEGER}
    }
};

var Players = sequelize.define(player_define.name, player_define.fields, opts);
Players.sync();

var Bays = sequelize.define(bays_define.name, bays_define.fields, opts);
Bays.sync();

var PlayerBays = sequelize.define('player_bays', {
    player_id: {
        type: Sequelize.INTEGER,
        references: {
            model: Players,
            key: 'id',
            deferrable: Sequelize.Deferrable.INITIALLY_IMMEDIATE
        }
    },
    bay_id: {
        type: Sequelize.INTEGER,
        references: {
            model: Bays,
            key: 'id',
            deferrable: Sequelize.Deferrable.INITIALLY_IMMEDIATE
        }
    },
    best_before: {type: Sequelize.DATE},
    status: {type: Sequelize.INTEGER}
}, opts);
PlayerBays.sync();

var levels = [];
for (var i = 1; i <= 20; i++) {
    levels.push({level: i, score_min: (i * 3), score_max: ((i + 1) * 3 - 1)});
}
console.log('levels', levels);

exports.getLevel = function (score) {
    var level = 1;
    levels.forEach(function (l) {
        if (score >= l.score_min && score <= l.score_max) {
            level = l.level
        }
    });
    return level;
};

exports.saveStatus = function (data, cb) {
    if (data && data.id) {
        Players.find({
            attributes: ['score', 'level', 'count_dead'],
            where: {player_id: (data.id).toString()}
        }).then(function (resultPlayer) {
            try {
                var changes = false;
                var newData = {};
                if (data.score) {
                    changes = true;
                    newData.score = parseInt(data.score);
                    // если изменились кол-во очков - то попробуем изменить уровень
                    if (resultPlayer.level !== exports.getLevel(newData.score)) {
                        newData.level = exports.getLevel(newData.score)
                    }
                }

                if (data.count_dead) {
                    changes = true;
                    newData.count_dead = parseInt(data.count_dead)
                }
                Players.update(
                    newData,
                    {
                        where: {
                            player_id: (data.id).toString()
                        }
                    }
                ).then(function (player) {
                        cb(null, {status: player[0], player_id: (data.id).toString()})
                    })
            } catch (e) {
                cb(e)
            }
        })
    }
};

exports.updatePlayer = function (data, cb) {
    if (data && data.player_id && data.score) {
        exports.getPlayerInfo(data, function (err, result) {
            try {
                if (!err) {
                    var changes = false;
                    var newData = {};
                    if (data.nickname && result.nickname && data.nickname !== result.nickname) {
                        changes = true;
                        newData.nickname = result.nickname
                    }
                    if (data.g_id && result.g_id && data.g_id !== result.g_id) {
                        changes = true;
                        newData.g_id = result.g_id
                    }
                    if (data.vk_id && result.vk_id && data.vk_id !== result.vk_id) {
                        changes = true;
                        newData.vk_id = result.vk_id
                    }
                    if (data.fb_id && result.fb_id && data.fb_id !== result.fb_id) {
                        changes = true;
                        newData.fb_id = result.fb_id
                    }
                    if (changes == true) {
                        Players.update(
                            newData,
                            {
                                where: {
                                    player_id: data.id
                                }
                            }
                        ).then(function (player) {
                                cb(null, player)
                            })
                    } else {
                        cb({result: 0, message: 'not changes'})
                    }
                } else {
                    cb(err)
                }
            } catch (e) {
                cb(e)
            }
        })
    }
};

exports.getRating = function (data, cb) {
    Players.findAll({
        attributes: ['player_id', 'nickname', 'score'],
        order: 'score DESC',
        limit: 7

    }).then(function (resultRating) {
        try {
            cb(null, resultRating)
        } catch (e) {
            cb(e)
        }
    })
};

exports.newPlayer = function (data, cb) {
    if (data && data.player_id) {
        Players.create({
            player_id: data.player_id
        }).then(function (np) {
            try {
                cb(null, np)
            } catch (e) {
                cb(e)
            }
        });
        Players.sync()
    } else {
        cb({status: 0, message: 'no player_id'})
    }
};

exports.getPlayerInfo = function (data, cb) {
    if (data && data.player_id) {
        Players.find({
            attributes: ['nickname', 'score', 'level', 'count_dead', 'g_id', 'vk_id', 'fb_id', 'player_id', 'id'],
            where: {player_id: data.player_id}
        }).then(function (resultPlayer) {
            try {
                cb(null, resultPlayer)
            } catch (e) {
                cb(e)
            }
        })
    } else {
        cb({status: 0, message: 'not player id'})
    }
};

exports.playerInfo = function (data, cb) {
    exports.getPlayerInfo({player_id: (data.player_id).toString()}, function (err, result) {
        if (err) {
            cb(err)
        } else {
            if (result == null || Object.keys(result).length == 0) {
                exports.newPlayer({player_id: data.player_id}, function (e, r) {
                    cb(err, r);
                })
            } else {

                cb(err, result)
            }
        }
    })
};

exports.baySkin = function (data, cb) {
    if (data && data.player_id && data.bay_id) {
        async.parallel({
            bays: Bays.findAll({
                attributes: ['name', 'price'],
                where: {
                    id: data.bay_id, status: 1
                }
            }).then(function (resultBays) {
                try {
                    cb(null, resultBays)
                } catch (e) {
                    cb(e)
                }
            }),
            player_bays: PlayerBays.findAll({
                attributes: ['bay_id'],
                where: {
                    id: data.bay_id,
                    status: 1
                }
            }).then(function (resultPlayerBays) {
                try {
                    cb(null, resultPlayerBays)
                } catch (e) {
                    cb(e)
                }
            })
        }, function (err, results) {
            // TODO сделать вычисления с валютой
            cb(err, result)
        })
    } else {
        cb({status: 0, message: 'not player_id or not bay_id'})
    }
};
