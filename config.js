var config = {
    local: {
        mode: 'local',
        port: 3000,
        // TODO нужно прикручивать
        dbMongo: 'mongodb://localhost:27017/space_shoot',
        // настройки базы
        dbMysql: {
            database: 'mysql',
            username: 'root',
            host: 'localhost',
            password: 'root',
            dialect: 'mysql'
        },
        secret: 'Space-Shoot-Secret',
        sessionMaxAge: 36000000,
        game: {
            width: 1000,
            height: 1000,
            maxPlayers: 10,
            maxHeartbeatInterval: 5000,
            player: {
                // базовая скорость игрока
                speed: 15,
                // базовые жизни игрока
                life: 10,
                // радиус игрока
                radius: 40,
                speedRotation: 0.1
            },
            bullet: {
                // базовая скорость пуль
                speed: 40,
                // базвый урон пуль
                power: 1,
                // время жизни пули (колиечество расчетов  - calcDo)
                life: 100
            },
            // расчетов в секунду (попадания-движеиня) отправка данных игрокам в секунду
            fps: 5,
            // раз в 5  сек
            updatePLayerStatistic: 5000
        }
    }
}
module.exports = function (mode) {
    return config[mode || process.argv[2] || 'local'] || config.local;
}
