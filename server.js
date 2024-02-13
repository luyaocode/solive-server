const { Table_System, Table_Client_Ips, Table_Game_Info, Table_Step_Info } = require('./ConstDefine.js');

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

const GameMode = {
    MODE_NONE: 0,
    MODE_SIGNAL: 1,
    MODE_MATCH: 2,
    MODE_ROOM: 3,
}

// SQLite
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('chaos-gomoku.db');
// 测试用
// dropTable(Table_Game_Info);
// dropTable(Table_Step_Info);
printTable(Table_Client_Ips);
db.serialize(() => {
    const create_table_system = `CREATE TABLE IF NOT EXISTS ${Table_System} (id INTEGER PRIMARY KEY AUTOINCREMENT,history_peek_users INT NOT NULL,timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)`;
    const create_table_client_ips = `CREATE TABLE IF NOT EXISTS ${Table_Client_Ips} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ipAddress TEXT,
        connectionTime DATETIME
    )`;
    const create_table_game_info = `CREATE TABLE IF NOT EXISTS ${Table_Game_Info} (
        gameId INTEGER PRIMARY KEY AUTOINCREMENT,
        roomId TEXT,
        socket1 TEXT,
        socket2 TEXT,
        dType INTEGER,
        scale TEXT,
        createTime DATETIME
    )`;
    const create_table_step_info = `CREATE TABLE IF NOT EXISTS ${Table_Step_Info} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        gameId INTEGER,
        socketId TEXT,
        x INTEGER,
        y INTEGER,
        currItem TEXT,
        nextItem TEXT,
        currentTime DATETIME,
        FOREIGN KEY (gameId) REFERENCES game_info(gameId)
    )`;
    db.run(create_table_system);
    db.run(create_table_client_ips);
    db.run(create_table_game_info);
    db.run(create_table_step_info);
});

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
        });
    });
}

// 发送表数据
function sendTableData(tableName, socket) {
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name=?", [tableName], (err, row) => {
        if (err) {
            console.error('Error checking for table existence:', err);
        }
    });
    db.all(`SELECT * FROM ${tableName}`, (err, tableData) => {
        if (err) {
            console.error('Error querying table: ', err);
            return;
        }
        socket.emit('tableData', { tableName, tableData });
    });
}

// 查询gameId
function searchGameId(roomId) {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            const query = `
            SELECT gameId
            FROM ${Table_Game_Info}
            WHERE roomId = ?
            ORDER BY createTime DESC
            LIMIT 1
            `;
            db.get(query, [roomId], (err, row) => {
                if (err) {
                    reject(err);
                }
                if (row) {
                    resolve(row.gameId);
                }
            });
        });
    });
}

// 插入步骤
function insertStepInfo(gameId, socketId, x, y, currItem, nextItem) {
    const insertQuery = `INSERT INTO ${Table_Step_Info} (gameId, socketId,x, y, currItem, nextItem, currentTime) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    const currentTime = new Date().toISOString();
    db.run(insertQuery, [gameId, socketId, x, y, currItem, nextItem, currentTime], (err) => {
        if (err) {
            console.error('Error inserting data:', err);
        }
    });
}

// 插入game_info表
function insertGameInfo(roomId, socket1, socket2, dType, scale) {
    const insertQuery = `INSERT INTO ${Table_Game_Info} (roomId, socket1, socket2, dType, scale, createTime) VALUES (?, ?, ?, ?, ?, ?)`;
    const createTime = new Date().toISOString();
    db.run(insertQuery, [roomId, socket1, socket2, dType, scale, createTime], (err) => {
        if (err) {
            console.error('Error inserting data:', err);
        }
    });
}

// 插入ip表
function insertIps(clientIp, currentTime) {
    if (clientIp === '::1') {
        return;
    }
    db.run("INSERT INTO client_ips (ipAddress, connectionTime) VALUES (?, ?)", [clientIp, currentTime], (err) => {
        if (err) {
            console.error('Error inserting IP address into database:', err);
        }
    });
}

// 查询表
function printTable(tableName) {
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name=?", [tableName], (err, row) => {
        if (err) {
            console.error('Error checking for table existence:', err);
        }
    });
    db.all(`SELECT * FROM ${tableName}`, (err, rows) => {
        if (err) {
            console.error('Error retrieving data from database:', err);
        } else {
            rows.forEach((row) => {
                console.log(row);
            });
        }
    });
}

// 删除表
function dropTable(tableName) {
    db.run(`DROP TABLE IF EXISTS ${tableName}`, (err) => {
        if (err) {
            console.error('Error dropping table:', err);
        }
    });
}

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

function restartGame(socket) {
    const anotherSocket = getAnotherSocketInRoom(socket);
    // 协商棋子颜色
    const pieces = negotiationPieceType();
    const user1PieceType = pieces[0];
    const user2PieceType = pieces[1];
    const roomId = users[socket.id].roomId;
    socket.emit('setPieceType', user1PieceType);
    anotherSocket.emit('setPieceType', user2PieceType);
    // 生成道具中
    const seeds = generateSeeds();
    io.to(roomId).emit('setItemSeed', seeds);
    // 协商房间设备类型
    const { roomDType, bWidth, bHeight } = negotiationDeviceType(socket, anotherSocket);
    io.to(roomId).emit('setRoomDeviceType', { roomDType, bWidth, bHeight });
    // 打印对局信息
    const startMsg = '游戏开始：（' + roomId + ',' + roomDType + ',' + bWidth + ' x ' + bHeight + '）[' + users[socket.id].nickName + '] 执 ' + pieces[0]
        + '，[' + users[anotherSocket.id].nickName + '] 执 ' + pieces[1];
    io.to(roomId).emit('message', startMsg);
    console.log(startMsg);
    // 持久化
    insertGameInfo(roomId, socket.id, anotherSocket.id, roomDType, bWidth + 'x' + bHeight);
}

io.on('connection', async (socket) => {
    // 更新ip表
    const clientIp = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
    const currentTime = new Date().toISOString();
    insertIps(clientIp, currentTime);

    // 欢迎语
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

            // 生成道具中
            const seeds = generateSeeds();
            socket.emit('setItemSeed', seeds);
            anotherSocket.emit('setItemSeed', seeds);

            // 协商房间设备类型
            const { roomDType, bWidth, bHeight } = negotiationDeviceType(socket, anotherSocket);
            io.to(roomId).emit('setRoomDeviceType', { roomDType, bWidth, bHeight });

            io.to(roomId).emit('joined');

            // 打印对局信息
            const startMsg = '游戏开始：（' + roomId + ',' + roomDType + ',' + bWidth + ' x ' + bHeight + '）[' +
                users[socket.id].nickName + '] 执 ' + user2PieceType
                + '，[' + users[anotherSocket.id].nickName + '] 执 ' + user1PieceType;
            io.to(roomId).emit('message', startMsg);
            console.log(startMsg);

            // 持久化
            insertGameInfo(roomId, socket.id, anotherSocket.id, roomDType, bWidth + 'x' + bHeight);
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
            const seeds = generateSeeds();
            io.to(roomId).emit('setItemSeed', seeds);
            const { roomDType, bWidth, bHeight } = negotiationDeviceType(socket, anotherSocket);
            io.to(roomId).emit('setRoomDeviceType', { roomDType, bWidth, bHeight });
            // 房间号
            io.to(roomId).emit('matchedRoomId', roomId);
            io.to(roomId).emit('broadcast', '匹配成功');
            // 打印对局信息
            const startMsg = '游戏开始：（' + roomId + ',' + roomDType + ',' + bWidth + ' x ' + bHeight + '）[' + users[socket.id].nickName + '] 执 ' + pieces[0]
                + '，[' + users[anotherSocket.id].nickName + '] 执 ' + pieces[1];
            io.to(roomId).emit('message', startMsg);
            console.log(startMsg);
            // 持久化
            insertGameInfo(roomId, socket.id, anotherSocket.id, roomDType, bWidth + 'x' + bHeight);
        }
    });


    socket.on('exitMatching', () => {
        matchingArray.splice(socket.id, 1);
    });

    // 监听离开房间事件
    socket.on('leaveRoom', () => {
        const user = users[socket.id];
        if (!user) {
            socket.emit("message", '用户已离开房间');
            return;
        }
        const roomId = user.roomId;
        const nickName = users[socket.id].nickName;
        socket.leave(roomId);
        users[socket.id].roomId = undefined;
        io.to(roomId).emit('playerLeaveRoom', nickName + '离开房间');
    });

    // 监听点击棋盘位置，转发给其他用户
    socket.on('step', ({ i, j, currItem, nextItem }) => {
        const anotherSocket = getAnotherSocketInRoom(socket);
        if (anotherSocket === undefined || anotherSocket === null || !anotherSocket.connected) {
            socket.emit("message", '对方网络未连接');
            return;
        }
        anotherSocket.emit('step', { i, j });
        console.log(users[socket.id].nickName + ': ' + i + ',' + j + ',' + currItem + ',' + nextItem);
        // 记录对局步骤
        searchGameId(users[socket.id].roomId)
            .then((gameId) => {
                insertStepInfo(gameId, socket.id, i, j, currItem, nextItem);
            })
            .catch((error) => {
                console.error("Error retrieving gameId:", error);
            });
    });

    socket.on('skipRound', () => {
        const user = users[socket.id];
        if (!user) {
            socket.emit("message", '对方网络未连接');
            return;
        }
        const roomId = users[socket.id].roomId;
        if (roomId) {
            io.to(roomId).emit('skipRound');
        }
    });

    // 监听重来一局事件
    socket.on('restart', ({ gameMode, gameOver }) => {
        const anotherSocket = getAnotherSocketInRoom(socket);
        if (anotherSocket === undefined || anotherSocket === null || !anotherSocket.connected) {
            return;
        }
        const nickName = users[socket.id].nickName;
        anotherSocket.emit('restart_request', { gameMode, nickName, gameOver });
    });

    socket.on('restart_response', (resp) => {
        const anotherSocket = getAnotherSocketInRoom(socket);
        if (anotherSocket === undefined || anotherSocket === null || !anotherSocket.connected) {
            return;
        }
        const roomId = users[socket.id].roomId;
        const socketId = socket.id;
        io.to(roomId).emit('restart_resp', { resp, socketId });
        if (resp) {
            setTimeout(() => {
                restartGame(socket);
                io.to(roomId).emit('message', '重新开局');
            }, 3000);
        }
    });

    // 监听悔棋事件
    socket.on('undoRoundRequest', () => {
        const anotherSocket = getAnotherSocketInRoom(socket);
        if (anotherSocket === undefined || anotherSocket === null || !anotherSocket.connected) {
            return;
        }
        anotherSocket.emit('undoRoundRequest');
    });

    socket.on('undoRoundResponse', (resp) => {
        const anotherSocket = getAnotherSocketInRoom(socket);
        if (anotherSocket === undefined) {
            return;
        }
        const roomId = users[socket.id].roomId;
        const socketId = socket.id;
        io.to(roomId).emit('undoRound', { resp, socketId });
    });

    // 登录
    socket.on('login', ({ account, passwd }) => {
        if (account === 'admin' && passwd === 'admin') {
            socket.emit('login_resp', true);
        }
        else {
            socket.emit('login_resp', false);
        }
    });

    // 发送数据库数据
    socket.on('fetchTable', (tableName) => {
        sendTableData(tableName, socket);
    });

    // 监听客户端断开连接事件
    socket.on('disconnect', () => {
        if (users[socket.id] && users[socket.id].roomId) {
            const roomId = users[socket.id].roomId;
            const nickName = users[socket.id].nickName;
            io.to(roomId).emit('playerDisconnected', nickName + '断开连接');
        }
        console.log(`Client disconnected: ${socket.id}`);
        delete connectedSockets[socket.id];
        delete users[socket.id];
        matchingArray = matchingArray.filter(item => item !== socket.id);
        let currentHeadCount = getCurrentHeadCount();
        io.emit('currentHeadCount', currentHeadCount);

    });
});


server.listen(5000, () => console.log('server is listening port 5000'));