// Const Define
const Piece_Type_Black = '●';
const Piece_Type_White = '○';
const DeviceType = {
    UNKNOWN: 0,
    MOBILE: 1,
    PC: 2,
}
const ErrorCode = {
    ROOM_ERR: 1000,
}

// SQLite
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('chaos-gomoku.db');
db.serialize(() => {
    const createSystemTable = "CREATE TABLE IF NOT EXISTS system (id INTEGER PRIMARY KEY AUTOINCREMENT,history_peek_users INT NOT NULL,timestamp DATETIME DEFAULT CURRENT_TIMESTAMP);";
    db.run(createSystemTable);
});

// Server
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
let matchingArray = []
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

function getCurrentHeadCount() {
    return io.sockets.sockets.size;
}

function getHistoryPeekUsers() {
    return new Promise((resolve, reject) => {
        let peek, timestamp;
        db.serialize(() => {
            db.get("SELECT MAX(history_peek_users) AS historyPeekUsers,MAX(timestamp) AS timestamp FROM system", (err, row) => {
                if (err) {
                    reject(err);
                }
                if (row) {
                    peek = row.historyPeekUsers;
                    timestamp = row.timestamp;
                    resolve({ peek, timestamp });
                } else {
                    console.log('没有找到历史最高在线人数记录');
                    resolve({ historyPeekUsers: 0, timestamp: null });
                }
            });
        });
    });
}

function updateHistoryPeekUsers(count) {
    const timestamp = new Date().toISOString();
    db.serialize(() => {
        db.run("INSERT INTO system (history_peek_users, timestamp) VALUES (?, ?)", [count, timestamp], function (err) {
            if (err) {
                return console.error(err.message);
            }
            console.log(`A row has been inserted with rowid ${this.lastID}`);
        });
    });
}

const crypto = require('crypto');

function generateRoomId(socketId1, socketId2) {
    // Combine the two socket IDs into a single string
    const combinedSocketId = `${socketId1}-${socketId2}`;

    // Create a hash of the combined socket ID using SHA-256 algorithm
    const hash = crypto.createHash('sha256');
    hash.update(combinedSocketId);

    // Get the hexadecimal representation of the hash
    const hashedSocketId = hash.digest('hex');

    // Return the first 16 characters of the hashed socket ID
    // to ensure a reasonable length for a Socket ID
    return hashedSocketId.slice(0, 16);
}

function negotiationDeviceType(socket, anotherSocket) {
    let roomDType, bWidth, bHeight;
    let deviceType = users[socket.id].deviceType;
    let boardWidth = users[socket.id].boardWidth;
    let boardHeight = users[socket.id].boardHeight;
    anotherDeviceType = users[anotherSocket.id].deviceType;
    if (deviceType < anotherDeviceType) {
        roomDType = deviceType;
        bWidth = boardWidth;
        bHeight = boardHeight;
    }
    else {
        roomDType = anotherDeviceType;
        bWidth = users[anotherSocket.id].boardWidth;
        bHeight = users[anotherSocket.id].boardHeight;
    }
    return { roomDType, bWidth, bHeight };
}

function negotiationPieceType() {
    return Math.random() > 0.5 ? [Piece_Type_Black, Piece_Type_White] :
        [Piece_Type_White, Piece_Type_Black];
}

io.on('connection', async (socket) => {
    console.log(`Client connected: ${socket.id}`);
    socket.emit('message', 'Hello, ' + socket.id);
    connectedSockets[socket.id] = socket;

    // 在线人数统计
    let currentHeadCount = getCurrentHeadCount();
    getHistoryPeekUsers()
        .then(({ peek, timestamp }) => {
            let historyPeekUsers;
            if (currentHeadCount > peek) {
                updateHistoryPeekUsers(currentHeadCount);
                historyPeekUsers = currentHeadCount;
            }
            else {
                historyPeekUsers = peek;
            }
            io.emit('currentHeadCount', currentHeadCount);
            io.emit('historyPeekUsers', historyPeekUsers);
        })
        .catch(err => {
            console.error('查询失败:', err);
        });

    // 监听加入房间请求
    socket.on('joinRoom', async ({ roomId, nickName, deviceType, boardWidth, boardHeight }) => {
        await socket.join(roomId);
        users[socket.id] = {
            nickName: nickName,
            roomId: roomId,
            deviceType: deviceType,
            boardWidth: boardWidth,
            boardHeight: boardHeight,
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
            if (otherSockets.length <= 0) {
                socket.emit('error', ErrorCode.ROOM_ERR);
                return;
            }
            const anotherSocket = otherSockets[0];
            socket.emit('setPieceType', user2PieceType);
            anotherSocket.emit('setPieceType', user1PieceType);
            let otherUserNickName = users[anotherSocket.id].nickName;
            socket.emit('message', ' 游戏开始：' + nickName + ' 执 ' + user2PieceType
                + '，' + otherUserNickName + ' 执 ' + user1PieceType);
            socket.to(roomId).emit('message', ' 游戏开始：' + nickName + ' 执 ' + user2PieceType
                + '，' + otherUserNickName + ' 执 ' + user1PieceType);

            // 生成道具中
            const seeds = generateSeeds();
            socket.emit('setItemSeed', seeds);
            anotherSocket.emit('setItemSeed', seeds);

            // 协商房间设备类型
            const { roomDType, bWidth, bHeight } = negotiationDeviceType(socket, anotherSocket);
            io.to(roomId).emit('setRoomDeviceType', { roomDType, bWidth, bHeight });
        }
    });

    // 监听匹配房间请求
    socket.on('matchRoom', async ({ deviceType, boardWidth, boardHeight }) => {
        users[socket.id] = {
            nickName: socket.id,
            roomId: undefined,
            deviceType: deviceType,
            boardWidth: boardWidth,
            boardHeight: boardHeight,
        };

        if (matchingArray.length === 0) {
            matchingArray.push(socket.id);
        }
        else {
            const anotherSocketId = matchingArray.shift();
            const anotherSocket = connectedSockets[anotherSocketId];
            const roomId = generateRoomId(socket.id, anotherSocket.id);
            await socket.join(roomId);
            await anotherSocket.join(roomId);
            users[socket.id].roomId = roomId;
            users[anotherSocket.id].roomId = roomId;
            const pieces = negotiationPieceType();
            socket.emit('setPieceType', pieces[0]);
            anotherSocket.emit('setPieceType', pieces[1]);
            io.to(roomId).emit('message', ' 游戏开始：' + users[socket.id].nickName + ' 执 ' + pieces[0]
                + '，' + users[anotherSocket.id].nickName + ' 执 ' + pieces[1]);
            const seeds = generateSeeds();
            io.to(roomId).emit('setItemSeed', seeds);
            const { roomDType, bWidth, bHeight } = negotiationDeviceType(socket, anotherSocket);
            io.to(roomId).emit('setRoomDeviceType', { roomDType, bWidth, bHeight });
            // 房间号
            io.to(roomId).emit('matchedRoomId', roomId);
            io.to(roomId).emit('broadcast', '匹配成功');
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
        matchingArray = matchingArray.filter(item => item !== socket.id);

        let currentHeadCount = getCurrentHeadCount();
        io.emit('currentHeadCount', currentHeadCount);
    });
});


server.listen(5000, () => console.log('server is listening port 5000'));