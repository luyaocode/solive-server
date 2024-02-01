const Piece_Type_Black = '●';
const Piece_Type_White = '○';

const express = require('express');
const http = require('http');
const app = express();
const server = http.createServer(app);
const socket = require('socket.io');
const io = socket(server, {
    cors: {
        origin: '*',
        method: ["GET", "POST"]
    }
});

app.get('/', (req, res) => {
    res.send('Hello, World!'); // 返回一个简单的响应
});

let connectedSockets = {}

let users = {}

function getRoomUserCount(roomId) {
    const room = io.sockets.adapter.rooms.get(roomId);
    if (room) {
        return room.size;
    } else {
        return 0;
    }
}

// 获取指定房间内的其他socket
function getOtherSocketsInRoom(roomId, currentSocket) {
    let otherSockets = [];
    const room = io.sockets.adapter.rooms.get(roomId);
    if (room) {
        room.forEach((socketId) => {
            if (socketId !== currentSocket.id) {
                otherSockets.push(io.sockets.sockets.get(socketId));
            }
        });
    }
    return otherSockets;
}

function generateSeeds() {
    let seeds = [];
    for (let i = 0; i < 20; i++) {
        for (let j = 0; j < 20; j++) {
            let randomValue;
            do { randomValue = Math.floor(Math.random() * 100) / 100; }
            while (randomValue == 1);
            seeds.push(randomValue);
        }
    }
    return seeds;
}

function getAnotherSocketInRoom(currentSocket) {
    let anotherSocket = null;
    const anotherUser = users[currentSocket.id];
    if (!anotherUser) {
        return anotherSocket;
    }
    const room = io.sockets.adapter.rooms.get(anotherUser.roomId);
    if (room) {
        room.forEach((socketId) => {
            if (socketId !== currentSocket.id) {
                anotherSocket = io.sockets.sockets.get(socketId);
            }
        });
    }
    return anotherSocket;
}

io.on('connection', async (socket) => {
    console.log(`Client connected: ${socket.id}`); // 打印客户端连接信息
    socket.emit('message', 'Hello, ' + socket.id);
    connectedSockets[socket.id] = socket;

    // 监听加入房间请求
    socket.on('joinRoom', async ({ roomId, nickName }) => {
        await socket.join(roomId);
        users[socket.id] = {
            nickName: nickName,
            roomId: roomId,
        };
        const roomSize = getRoomUserCount(roomId);
        if (roomSize === 1) {
            socket.emit('message', '创建房间 ' + roomId);
            socket.emit('message', nickName + ' 进入房间');
            socket.emit('message', '由于该房间人数不足，暂时无法开局，请您耐心等待');

        } else if (roomSize === 2) {
            socket.emit('message', nickName + ' 进入房间 ');
            socket.to(roomId).emit('broadcast', nickName + ' 进入房间 ');
            let user1PieceType = Math.random() > 0.5 ? Piece_Type_Black : Piece_Type_White;
            let user2PieceType = user1PieceType === Piece_Type_Black ? Piece_Type_White : Piece_Type_Black;
            const otherSockets = getOtherSocketsInRoom(roomId, socket);
            socket.emit('setPieceType', user2PieceType);
            otherSockets[0].emit('setPieceType', user1PieceType);
            let otherUserNickName = users[otherSockets[0].id].nickName;
            socket.emit('message', ' 游戏开始：' + nickName + ' 执 ' + user2PieceType
                + '，' + otherUserNickName + ' 执 ' + user1PieceType);
            socket.to(roomId).emit('message', ' 游戏开始：' + nickName + ' 执 ' + user2PieceType
                + '，' + otherUserNickName + ' 执 ' + user1PieceType);

            // 生成道具中
            const seeds = generateSeeds();
            socket.emit('setItemSeed', seeds);
            otherSockets[0].emit('setItemSeed', seeds);
        }
    });

    // 监听点击棋盘位置，转发给其他用户
    socket.on('step', ({ i, j }) => {
        const anotherSocket = getAnotherSocketInRoom(socket);
        if (anotherSocket) {
            anotherSocket.emit('step', { i, j });
            console.log(users[socket.id].nickName + ': ' + i + ',' + j)
        }
        else {
            socket.emit("message", '对方网络未连接');
        }
    });

    // 监听离开房间事件

    // 监听客户端断开连接事件
    socket.on('disconnect', () => {
        socket.broadcast.emit('callEnded');
        console.log(`Client disconnected: ${socket.id}`);
        delete connectedSockets[socket.id];
        delete users[socket.id];
    });
});


server.listen(5000, () => console.log('server is listening port 5000'));