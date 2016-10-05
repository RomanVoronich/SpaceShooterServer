# Запуск сервера

## Предварительные настройки

mysql-server

nodejs v>=4.2

## Установка
```
cd server/
npm install
```

## Запуск для продакшена

```
sudo npm install forever
cd server/
forever start index.js
```

### рестарт сервера

```
forever restart index.js
```


## Запуск для тестового сервера

```
sudo npm install nodemon
cd server/
nodemon
```



