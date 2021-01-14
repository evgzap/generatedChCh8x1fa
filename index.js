
var environment = process.env.RTC_ENV || 'local';
var express = require('express');
var cors = require('cors');

const http = require('http');
var io = require('socket.io')(http)
var logger = require('./logger').logger(environment);
const path = require('path')

var app = express();

function redirectSec(req, res, next) {
    if (req.headers['x-forwarded-proto'] == 'http') {
        var redirect = 'https://' + req.headers.host + req.path;
        console.log('Redirect to:' + redirect);
        res.redirect(redirect);
    } else {
        return next();
    }
}

app.use(redirectSec);
app.use(express.static(path.join(__dirname, '/public')));

app.use(cors());
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.engine('html', require('ejs').renderFile);

app.get('/', function (req, res) {
    res.render('home');
});

app.get('/asddd', function (req, res) {
    res.render('room');
});

var server = http.createServer(app);
const port = process.env.PORT || 3000;
server.listen(port);
console.log(port)
io.listen(server, { log: false, origins: '*:*' });

// var io = require('socket.io').listen(server);

io.on('connection',  (socket) => {
    function log() {
        var array = [">>> Message from server: "];
        for (var i = 0; i < arguments.length; i++) {
            array.push(arguments[i]);
        }
        socket.emit('log', array);
    }

    socket.on('message', function (message) {
        log('Got message: ', message);
        logger.info("message: ", message);
        socket.broadcast.to(socket.room).emit('message', message);
    });

    socket.on('create or join', function (message) {
        var room = message.room;
        socket.room = room;
        var participantID = message.from;
        configNameSpaceChannel(participantID);

        io.of('/').in(room).clients(function (error, clients) {
            var numClients = clients.length;

            log('Room ' + room + ' has ' + numClients + ' client(s)');
            log('Request to create or join room', room);

            if (numClients == 0) {
                logger.info(participantID + " joined first. Creates room " + room);
                socket.join(room);
                socket.emit('created', room);
            } else {
                logger.info(participantID + " joins room " + room);
                io.sockets.in(room).emit('join', room);
                socket.join(room);
                socket.emit('joined', room);
            }
        })
    });

    function configNameSpaceChannel(room) {
        var nsp = '/' + room;
        var socketNamespace = io.of(nsp);

        logger.info('ConfigNameSpaceChannel:' + nsp);

        socketNamespace.on('connection', function (socket) {
            socket.on('message', function (message) {
                // Send message to everyone BUT sender
                socket.broadcast.emit('message', message);
            });

        });

        return socketNamespace;
    }

});
