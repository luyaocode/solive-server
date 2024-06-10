// const { Table_System, Table_Client_Ips, Table_Game_Info, Table_Step_Info,
//     Table_User_Info
// } = require('./ConstDefine.js');
import {
    Table_System, Table_Client_Ips, Table_Game_Info, Table_Step_Info,
    Table_User_Info
} from "./ConstDefine.js";
// const { formatDate } = require("./plugins.js");
// const ffi = require("ffi-napi");
import * as ffi from 'ffi-napi';

// 定义要调用的函数及其参数类型
const lib = ffi.Library('lib/libChaosGomokuUtils', {
    'getformatCurrBjTime': ['string', []]
});

import {
    createWorker,
    createWebrtcTransport,
} from './dist/worker.js';
// const createWorker = require('./dist/worker.js');
function getformatNowTime() {
    return lib.getformatCurrBjTime();
}
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

const PublicMsg_Max_Length = 5000;
const Notice_Max_Length = 1000;
const TitleNotice = {
    message: '社会主义核心价值观：富强、民主、文明、和谐；自由、平等、公正、法治；爱国、敬业、诚信、友善。\
    Core values of socialism: Prosperity, democracy, civilization, harmony; freedom, equality, justice, rule of law; patriotism, dedication, integrity, kindness.\
    सोशलिज़म के मूल्यों: समृद्धि, लोकतंत्र, सभ्यता, सामंजस्य; स्वतंत्रता, समानता, न्याय, कानून का शासन; देशभक्ति, समर्पण, ईमानदारी, मित्रता।\
    社会主義の核心価値観: 繁栄、民主主義、文明、調和; 自由、平等、正義、法の支配; 愛国心、献身、誠実、親切。\
    Основные ценности социализма: процветание, демократия, цивилизация, гармония; свобода, равенство, справедливость, верховенство права; патриотизм, преданность, целостность, доброта.\
    Valori fondamentali del socialismo: prosperità, democrazia, civiltà, armonia; libertà, uguaglianza, giustizia, stato di diritto; patriottismo, dedizione, integrità, gentilezza.\
    Valeurs fondamentales du socialisme : prospérité, démocratie, civilisation, harmonie ; liberté, égalité, justice, État de droit ; patriotisme, dévouement, intégrité, gentillesse.\
    Kernwerte des Sozialismus: Wohlstand, Demokratie, Zivilisation, Harmonie; Freiheit, Gleichheit, Gerechtigkeit, Rechtsstaatlichkeit; Patriotismus, Hingabe, Integrität, Freundlichkeit.\
    사회주의의 핵심 가치: 번영, 민주주의, 문명, 조화; 자유, 평등, 정의, 법치; 애국심, 헌신, 정직, 친절.\
    القيم الأساسية للإشتراكية: الازدهار، الديمقراطية، الحضارة، الانسجام؛ الحرية، المساواة، العدالة، سيادة القانون؛ الوطنية، التفاني، النزاهة، اللطف.\
    Βασικές αξίες του σοσιαλισμού: ευημερία, δημοκρατία, πολιτισμός, αρμονία; ελευθερία, ισότητα, δικαιοσύνη, κράτος δικαίου; πατριωτισμός, αφοσίωση, ακεραιότητα, ευγένεια.',
    id: '小棋',
    timestamp: Date.now(),
    locationData: {
        country: '中国',
        region: '湖北',
    }
}

// axios
// const axios = require('axios');
import axios from "axios";

// SQLite
// const sqlite3 = require('sqlite3').verbose();
import sqlite3 from "sqlite3";

const db = new sqlite3.Database('chaos-gomoku.db');
// 测试用
// dropTable(Table_Game_Info);
// dropTable(Table_Step_Info);
// dropTable(Table_Client_Ips);
// printTable(Table_Client_Ips);
db.serialize(() => {
    const create_table_system = `CREATE TABLE IF NOT EXISTS ${Table_System} (id INTEGER PRIMARY KEY AUTOINCREMENT,history_peek_users INT NOT NULL,timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)`;
    const create_table_client_ips = `CREATE TABLE IF NOT EXISTS ${Table_Client_Ips} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ipAddress TEXT,
        location TEXT,
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

    const create_user_info = `CREATE TABLE IF NOT EXISTS ${Table_User_Info} (
        UserID INTEGER PRIMARY KEY AUTOINCREMENT,
        UserName TEXT NOT NULL UNIQUE,
        PasswordHash TEXT NOT NULL,
        Salt TEXT NOT NULL,
        Iterations INTEGER NOT NULL,
        CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        LastModifiedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`;
    db.run(create_table_system);
    db.run(create_table_client_ips);
    db.run(create_table_game_info);
    db.run(create_table_step_info);
    db.run(create_user_info);
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
    const timestamp = getBeijingTime();
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
    const currentTime = getBeijingTime();
    db.run(insertQuery, [gameId, socketId, x, y, currItem, nextItem, currentTime], (err) => {
        if (err) {
            console.error('Error inserting data:', err);
        }
    });
}

// 插入game_info表
function insertGameInfo(roomId, socket1, socket2, dType, scale) {
    const insertQuery = `INSERT INTO ${Table_Game_Info} (roomId, socket1, socket2, dType, scale, createTime) VALUES (?, ?, ?, ?, ?, ?)`;
    const createTime = getBeijingTime();
    db.run(insertQuery, [roomId, socket1, socket2, dType, scale, createTime], (err) => {
        if (err) {
            console.error('Error inserting data:', err);
        }
    });
}

// 插入ip表
function insertIps(clientIp, currentTime, location) {
    // if (clientIp === '::1') {
    //     return;
    // }
    db.run("INSERT INTO client_ips (ipAddress, connectionTime,location) VALUES (?, ?,?)", [clientIp, currentTime, location], (err) => {
        if (err) {
            console.error('Error inserting IP address into database:', err);
        }
    });
}

// 打印表
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

// 查询
function getAllRecordsByCondition(tableName, condition) {
    return new Promise((resolve, reject) => {
        const query = `SELECT * FROM ${tableName} WHERE ${condition}`;
        db.all(query, (err, rows) => {
            if (err) {
                reject(err.message);
                return;
            }
            resolve(rows);
        });
    });
}

// 插入
function insertRecord(tableName, record) {
    return new Promise((resolve, reject) => {
        const keys = Object.keys(record);
        const placeholders = keys.map(() => '?').join(',');
        const values = Object.values(record);
        const query = `INSERT INTO ${tableName} (${keys.join(',')}) VALUES (${placeholders})`;
        db.run(query, values, function (err) {
            if (err) {
                reject(err.message);
                return;
            }
            resolve(this.lastID); // 返回插入的记录的自增 ID
        });
    });
}

// 删除记录
function deleteRecordByCondition(tableName, condition) {
    const sql = `DELETE FROM ${tableName} WHERE ${condition}`;
    db.run(sql, function (err) {
        if (err) {
            return;
        }
        else {
            console.log(`${tableName} 删除记录 ${condition}`)
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

// Jwt
// const jwt = require('jsonwebtoken');
import jwt from 'jsonwebtoken';

const secretKey = 'chaos-gomoku'; // 用于签名Token的密钥，务必保密
const payload = { userId: 'admin', username: 'admin' };

// 生成Token的函数
function generateToken(payload, secretKey, expiresIn = '1h') {
    return jwt.sign(payload, secretKey, { expiresIn });
}

// 验证Token的函数
function verifyToken(token, secretKey) {
    try {
        const decoded = jwt.verify(token, secretKey);
        return { isValid: true, payload: decoded };
    } catch (error) {
        return { isValid: false, error: error.message };
    }
}

// Server
// const express = require('express');
// const http = require('http');
// const https = require('https');
// const app = express();
// const fs = require('fs');
// const path = require('path');

import express from 'express';
import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';

const app = express();

import { fork } from 'child_process';
// 创建子进程来处理 POST 请求
const childProcess = fork('./luyaocode.github.io.server.js');

// 当收到消息时，处理来自子进程的响应
childProcess.on('message', (message) => {
    // console.log('Received message from child process:', message);
});

let ssl_crt, ssl_key;
let server, options;
if (process.env.NODE_ENV === 'prod') {
    ssl_crt = '/home/luyao/codes/chaos-gomoku/ssl/api.chaosgomoku.fun.pem';
    ssl_key = '/home/luyao/codes/chaos-gomoku/ssl/api.chaosgomoku.fun.key';
    options = {
        key: fs.readFileSync(ssl_key),
        cert: fs.readFileSync(ssl_crt)
    }
    server = https.createServer(options, app);
}
else if (process.env.NODE_ENV === 'dev') {
    server = http.createServer(app);
}

// const socket = require('socket.io');
import * as socket from 'socket.io';

const io = new socket.Server(server, {
    cors: {
        origin: '*',
        method: ["GET", "POST"]
    }
});

app.get('/', (req, res) => {
    res.send('Hello, World!'); // 返回一个简单的响应
});

// 静态文件
app.use('/live-room', express.static('uploads'));

let connectedSockets = {}
let users = {}
let matchingArray = []
let publicMsgs = [TitleNotice] // 公告板
let teamMsgs = [] // 组队公告
let liveRooms = {} // 直播间
let waitingViewers = {}  // 直播间中等待观看直播的用户
function getRoomUserCount(roomId) {
    const room = io.sockets.adapter.rooms.get(roomId);
    if (room) {
        return room.size;
    } else {
        return 0;
    }
}
function getRoomViewerCount(roomId) {
    return getRoomUserCount(roomId) - 1;
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

// const crypto = require('crypto');
import crypto from 'crypto';

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
    const data = { sid: socket.id, asid: anotherSocket.id };
    io.to(roomId).emit('setRoomDeviceType', { roomDType, bWidth, bHeight, data });
    // 打印对局信息
    const startMsg = '游戏开始：（' + roomId + ',' + roomDType + ',' + bWidth + ' x ' + bHeight + '）[' + users[socket.id].nickName + '] 执 ' + pieces[0]
        + '，[' + users[anotherSocket.id].nickName + '] 执 ' + pieces[1];
    io.to(roomId).emit('message', startMsg);
    console.log(startMsg);
    // 持久化
    insertGameInfo(roomId, socket.id, anotherSocket.id, roomDType, bWidth + 'x' + bHeight);
}

function getBeijingTime() {
    // 创建一个新的Date对象
    const currentDate = new Date();
    // 将Date对象转换为北京时间的ISO 8601格式字符串
    const beijingTimeISO = currentDate.toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        dateStyle: 'full', // 日期部分使用完整格式
        timeStyle: 'full' // 时间部分使用简短格式
    }).replace(/\//g, '-').replace(' 中国标准时间 ', ' ');
    return beijingTimeISO;
}

// 视频通话
function handleVideoChat(socket) {
    socket.on("callUser", (data) => {
        io.to(data.userToCall).emit("callUser", {
            signal: data.signalData, from: data.from, name: data.name,
            isInGame: data.isInGame
        });
    });

    socket.on("acceptCall", (data) => {
        io.to(data.to).emit("callAccepted", { signal: data.signal, name: data.name });
    });

    socket.on("rejectCall", (data) => {
        io.to(data.to).emit("callRejected");
    });

    socket.on("endConnect", (data) => {
        io.to(data.me).emit("connectEnded");
        io.to(data.another).emit("connectEnded");
    });

    socket.on("callCanceled", (data) => {
        io.to(data.to).emit("callCanceled");
    });

    socket.on("changeTrack", (data) => {
        io.to(data.to).emit("changeTrackAgreed", data.signal);
    });

    socket.on("isBusy", (data) => {
        io.to(data.to).emit("isBusy");
    });

    socket.on("nomedia", (data) => {
        io.to(data.to).emit("nomedia");
    });

    socket.on("peerAudioStatus", (data) => {
        io.to(data.to).emit("peerAudioStatus", data.status);
    });

    socket.on("shareScreen", (data) => {
        io.to(data.idToShare).emit("shareScreen", { signal: data.signalData, from: data.from });
    });

    socket.on("acceptShareScreen", (data) => {
        io.to(data.to).emit("shareScreenAccepted", data.signal);
    });

    socket.on("shareScreenStopped", (data) => {
        io.to(data.to).emit("shareScreenStopped");
    });

    socket.on("stopShareScreen", (data) => {
        io.to(data.to).emit("stopShareScreen");
    });
}

const generateLiveRoomId = (socketId) => {
    const combinedSocketId = `${socketId}`;
    const hash = crypto.createHash('sha256');
    hash.update(combinedSocketId);
    const hashedSocketId = hash.digest('hex');
    return hashedSocketId.slice(0, 8);
};

//////////////////// 直播///////////////////////
// const TreeModel = require('tree-model');
import TreeModel from 'tree-model';
/**
 * lid:房间号
 * {
 *  treeModel:树模型
 *  root:根节点
 * }
 *
 */
const liveTrees = {}
const ChildrenMaxSize = 8;

const getSocketRoomsExcludeSelf = (socket) => {
    const allRooms = Array.from(socket.rooms.keys());
    const otherRooms = allRooms.filter(roomId => roomId !== socket.id);
    return otherRooms;
}

function handleLiveStream(socket) {

    /**
     * 找到房间中合适的转播节点
     */
    const getStreamer = (lid) => {
        let streamerNode;
        const liveTreeRoot = liveTrees[lid].root;
        if (liveTreeRoot) {
            liveTreeRoot.walk({
                strategy: 'breadth',
            }, (node) => {
                if (node.children.length < ChildrenMaxSize) {
                    streamerNode = node;
                    return false;
                }
            });
        }
        return streamerNode;
    };

    const getTreeNodeBySid = (lid, sid) => {
        let resNode;
        const liveTreeRoot = liveTrees[lid]?.root?.first();
        if (liveTreeRoot) {
            liveTreeRoot.walk({
                strategy: 'breadth',
            }, (node) => {
                if (node.model.sid === sid) {
                    resNode = node;
                    return false;
                }
            });
        }
        return resNode;
    };

    const leaveLiveRoom = () => {
        const otherRooms = getSocketRoomsExcludeSelf(socket);
        if (otherRooms.length > 0) {
            const lid = otherRooms[0];
            // 移除节点
            const node = getTreeNodeBySid(lid, socket.id);
            if (node) {
                // 以node为根刷新树结构，所有子节点重连
                node.walk({
                    strategy: 'breadth',
                }, (node) => {
                    const sid = node.model.sid;
                    if (connectedSockets[sid]) {
                        connectedSockets[sid].emit("reconnectLiveRoom", lid);
                    }
                });
                node.drop();
            }
            // 更新观众数量
            const nViewer = getRoomViewerCount(lid);
            io.to(lid).emit('getViewerNumber', nViewer - 1);
        }

    };

    const getAllRoomViewerNumber = () => {
        let viewers = {};
        for (let key in liveRooms) {
            const nViewer = getRoomViewerCount(liveRooms[key]);
            viewers[liveRooms[key]] = nViewer;
        }
        return viewers;
    };
    const isRelay = (to) => {
        let isRelay = false;
        const otherRooms = getSocketRoomsExcludeSelf(socket);
        if (otherRooms.length > 0) {
            const lid = otherRooms[0];
            const rootSid = liveTrees[lid]?.root?.model?.sid;
            isRelay = rootSid !== to;
        }
        return isRelay;
    }

    socket.on("createLiveRoom", () => {
        let lid;
        if (liveRooms[socket.id]) {
            lid = liveRooms[socket.id];
        }
        else {
            lid = generateLiveRoomId(socket.id);
            liveRooms[socket.id] = lid;
        }
        if (!liveTrees[lid]) {
            const treeModel = new TreeModel();
            const rootNode = treeModel.parse({
                sid: socket.id,
            });
            liveTrees[lid] = {
                treeModel: treeModel,
                root: rootNode,
            }
            socket.join(lid);
        }
        socket.emit("liveStreamRoomId", lid);
    });

    socket.on("enterLiveRoom", (lid) => {
        let res = false;
        for (let sid in liveRooms) {
            if (liveRooms[sid] === lid) {
                // 找到房间中可用的转播者
                const streamerNode = getStreamer(lid);
                if (streamerNode) {
                    const newNode = liveTrees[lid].treeModel.parse({ sid: socket.id });
                    streamerNode.addChild(newNode);
                    res = streamerNode.model.sid;
                    break;
                }
            }
        }
        if (res) {
            const anchorSid = Object.keys(liveRooms).find(key => liveRooms[key] === lid);
            let isRelay = res !== anchorSid; // 是否转播
            io.to(res).emit("enterLiveRoomRequest", {
                vid: socket.id,
                isRelay: isRelay,
            });
        }
        else {
            socket.emit("liveRoomNotExist", "liveRoomNotExist");
        }
    });

    socket.on("queryLiveRooms", () => {
        const viewers = getAllRoomViewerNumber();
        socket.emit("getLiveRooms", { liveRooms, viewers });
    });

    socket.on("anchorOffline", (data) => {
        const lid = liveRooms[socket.id];
        if (lid) {
            if (waitingViewers[lid]) {
                waitingViewers[lid].add(data);
            }
            else {
                waitingViewers[lid] = new Set();
                waitingViewers[lid].add(data);
            }
            io.to(data).emit("anchorOffline", "anchorOffline");
        }
    });

    socket.on("queryWaitingViewers", () => {
        const lid = liveRooms[socket.id];
        let res;
        if (lid && waitingViewers[lid]) {
            res = Array.from(waitingViewers[lid]);
        }
        socket.emit("queryWaitingViewersResult", res);
    });

    socket.on("pushStream", (data) => {
        io.to(data.userToCall).emit("getLiveStream", {
            signal: data.signalData, from: data.from, name: data.name,
            isInGame: data.isInGame, rootAnchorSid: data.rootAnchorSid,
        });
    });

    socket.on("acceptStream", async (data) => {
        io.to(data.to).emit("streamAccepted", { signal: data.signal, name: data.name, from: data.from });

        // update live room's viewer number
        const viewerSocket = connectedSockets[data.from];
        const socketTo = connectedSockets[data.to];
        const otherRooms = getSocketRoomsExcludeSelf(socketTo);
        if (otherRooms.length > 0) {
            const lid = otherRooms[0];
            if (viewerSocket) {
                await viewerSocket.join(lid);
                const nViewer = getRoomViewerCount(lid);
                io.to(lid).emit('getViewerNumber', nViewer);
            }
        }
    });

    socket.on("pushScreenStream", (data) => {
        io.to(data.idToShare).emit("getLiveScreenStream", { signal: data.signalData, from: data.from });
    });

    socket.on("acceptLiveScreenStream", (data) => {
        io.to(data.to).emit("liveScreenStreamAccepted", { signal: data.signal, from: data.from });
    });

    socket.on("stopLiveStream", (data) => {
        io.to(data.to).emit("liveStreamStopped", { from: data.from });
    });

    socket.on("stopLiveScreenStream", (data) => {
        io.to(data.to).emit("liveScreenStreamStopped", { from: data.from });
    });

    socket.on("leaveLiveRoom", (data) => {
        deleteWaitingViewer(socket.id);
        io.to(data.to).emit("viewerLeaveLiveRoom", { from: data.from });
    });

    socket.on("refreshLiveStream", (data) => {
        const bRelay = isRelay(data.to);
        io.to(data.to).emit("refreshLiveStream", {
            from: data.from,
            isRelay: bRelay
        });
    });

    socket.on("refreshLiveScreenStream", (data) => {
        const bRelay = isRelay(data.to);
        io.to(data.to).emit("refreshLiveScreenStream", {
            from: data.from,
            isRelay: bRelay
        });
    });

    socket.on("pushLiveMsgs", (data) => {
        const otherRooms = getSocketRoomsExcludeSelf(socket);
        if (otherRooms.length > 0) {
            const lid = otherRooms[0];
            socket.to(lid).emit("getLiveMsgs", data);
        }
    });

    socket.on('disconnecting', () => {
        leaveLiveRoom();
    });

    socket.on('disconnect', () => {
        deleteWaitingViewer(socket.id);
        const lid = liveRooms[socket.id];
        delete liveRooms[socket.id];
        if (lid) {
            delete liveTrees[lid];
        }
    });
}

const deleteWaitingViewer = (viewerId) => {
    for (const key in liveRooms) {
        if (liveRooms.hasOwnProperty(key)) {
            const set = waitingViewers[liveRooms[key]];
            if (set && set.has(viewerId)) {
                set.delete(viewerId);
                break;
            }
        }
    }
};

function handleFileUpload(socket) {
    socket.on('liveRoomScreenShoot', imageData => {
        const lid = liveRooms[socket.id];
        if (!lid) return;
        const fileName = `${lid}.jpg`;
        const fileName_with_timestamp = `${lid}_${Date.now()}.jpg`;
        const filePath = `uploads/${fileName}`;
        const tempFilePath = path.join('temp', fileName_with_timestamp); // 保存到 temp 文件夹的路径

        const base64Data = imageData.replace(/^data:image\/jpeg;base64,/, '');

        const imageDataBuffer = Buffer.from(base64Data, 'base64');
        fs.writeFile(filePath, imageDataBuffer, err => {
            if (err) {
                console.error('Error saving frame:', err);
            } else {
                console.log('Frame saved:', fileName);
                fs.copyFile(filePath, tempFilePath, err => {
                    if (err) {
                        console.error('Error saving frame to temp:', err);
                    } else {
                        console.log('Frame saved to temp:', fileName_with_timestamp);
                    }
                });
            }
        });
    });
}

function publishNotice(socket, noticeType, loc, roomId, nickName) {
    const newNotice = {
        id: socket.id,
        type: noticeType,
        timestamp: Date.now(),
        locationData: loc,
        roomId: roomId,
        nickName: nickName
    };
    teamMsgs.push(newNotice);
    if (teamMsgs.length > Notice_Max_Length) {
        teamMsgs = teamMsgs.slice(teamMsgs / 2);
    }
    io.emit('notice', newNotice);
}

async function getLocationByIP(ip, api = 'https://ipinfo.io',) {
    try {
        const response = await axios.get(`${api}/${ip}/json`);
        const { country, region, city } = response.data;
        return { country, region, city };
    } catch (error) {
        console.error('Error retrieving location information:', error.message);
        return {
            country: undefined,
            region: undefined,
            city: undefined
        };
    }
}

function extractIPv4FromIPv6(ipv6) {
    // 使用正则表达式匹配IPv4地址部分
    const match = ipv6.match(/::ffff:(\d+\.\d+\.\d+\.\d+)/);
    if (match && match[1]) {
        return match[1]; // 返回提取到的IPv4地址
    }
    return ipv6; // 如果未找到IPv4地址，则返回null
}

// 定义生成哈希密码的函数
function generateHashedPassword(password) {
    return new Promise((resolve, reject) => {
        // 生成盐
        const salt = crypto.randomBytes(16).toString('hex');
        // 设置迭代次数
        const iterations = 1000;
        // 使用 PBKDF2 算法生成哈希密码
        crypto.pbkdf2(password, salt, iterations, 64, 'sha512', (err, derivedKey) => {
            if (err) {
                reject(err);
                return;
            }
            const hashedPassword = derivedKey.toString('hex');
            // 将生成的哈希密码、盐和迭代次数一起返回
            resolve({ hashedPassword, salt, iterations });
        });
    });
}

function verifyPassword(password, salt, iterations, hashedPassword) {
    return new Promise((resolve, reject) => {
        crypto.pbkdf2(password, salt, iterations, 64, 'sha512', (err, derivedKey) => {
            if (err) {
                reject(err);
                return;
            }
            const inputHashedPassword = derivedKey.toString('hex');
            // 比对用户输入的哈希密码和数据库中存储的哈希密码是否相同
            if (inputHashedPassword === hashedPassword) {
                resolve(true); // 密码验证通过
            } else {
                resolve(false); // 密码验证失败
            }
        });
    });
}

function handleGame(socket) {
    // 监听加入房间请求
    socket.on('joinRoom', async ({ roomId, nickName, deviceType, boardWidth, boardHeight, locationData, shareRoom }) => {
        const roomSize = getRoomUserCount(roomId);
        if (roomSize === 2) {
            socket.emit('roomIsFull');
            return;
        }
        await socket.join(roomId);
        users[socket.id] = {
            nickName: nickName,
            roomId: roomId,
            deviceType: deviceType,
            boardWidth: boardWidth,
            boardHeight: boardHeight,
            isReady: false,
        };
        if (roomSize === 0) {
            socket.emit('message', '创建房间 ' + roomId);
            socket.emit('message', nickName + ' 进入房间');
            socket.emit('message', '由于该房间人数不足，暂时无法开局，请您耐心等待');
            // 发布公告
            if (shareRoom) {
                publishNotice(socket, 'createRoom', locationData, roomId, nickName);
            }
        } else if (roomSize === 1) {
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
            const data = { sid: socket.id, asid: anotherSocket.id };
            io.to(roomId).emit('setRoomDeviceType', { roomDType, bWidth, bHeight, data });

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
    socket.on('matchRoom', async ({ deviceType, boardWidth, boardHeight, avatarIndex, locationData }) => {
        users[socket.id] = {
            nickName: socket.id,
            roomId: undefined,
            deviceType: deviceType,
            boardWidth: boardWidth,
            boardHeight: boardHeight,
            avatarIndex: avatarIndex,
            isReady: false,
        };

        if (matchingArray.length === 0) {
            matchingArray.push(socket.id);
            // 发布公告
            publishNotice(socket, 'startMatch', locationData);
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
            const data = { sid: socket.id, asid: anotherSocketId };
            io.to(roomId).emit('setRoomDeviceType', { roomDType, bWidth, bHeight, data });
            // 房间号
            io.to(roomId).emit('matchedRoomId', roomId);
            io.to(roomId).emit('broadcast', '匹配成功');

            // 交换头像
            socket.emit('set_avatar_pb', users[anotherSocket.id].avatarIndex);
            anotherSocket.emit('set_avatar_pb', users[socket.id].avatarIndex);

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
        users[socket.id].isReady = false;
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

    socket.on('completelyReady', () => {
        const anotherSocket = getAnotherSocketInRoom(socket);
        if (anotherSocket === undefined || anotherSocket === null || !anotherSocket.connected) {
            socket.emit("message", '对方网络未连接');
            return;
        }
        const roomId = users[socket.id].roomId;
        if (users[anotherSocket.id].isReady) {
            io.to(roomId).emit('completelyReady');
        }
        else {
            users[socket.id].isReady = true;
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

    socket.on('inviteGame', () => {
        const otherSocketIds = Object.keys(connectedSockets).filter(id => {
            return id !== socket.id && connectedSockets[id].rooms.size === 1 &&
                connectedSockets[id].rooms.has(id);
        });
        if (otherSocketIds.length > 0) {
            const randomIndex = Math.floor(Math.random() * otherSocketIds.length);
            const randomSocketId = otherSocketIds[randomIndex];
            io.to(randomSocketId).emit('inviteGame');
        }
    });

    // 监听聊天
    socket.on('chatMessage', (newMessage) => {
        const anotherSocket = getAnotherSocketInRoom(socket);
        if (anotherSocket === undefined || anotherSocket === null || !anotherSocket.connected) {
            return;
        }
        const { text } = newMessage;
        anotherSocket.emit('chat_message', text);
    })
}

async function handleStart(socket) {
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
    // 发送公告板消息
    socket.emit('publicMsgs', publicMsgs);
    socket.emit('notices', teamMsgs);

    // 欢迎语
    socket.emit('connected');
    console.log(`Client connected: ${socket.id}`);
    socket.emit('message', 'Hello, ' + socket.id);
    connectedSockets[socket.id] = socket;

    // 更新ip表
    const clientIp = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
    const ipv4 = extractIPv4FromIPv6(clientIp);
    const currentTime = getBeijingTime();
    const { country, region, city } = await getLocationByIP(ipv4);
    const location = country + ' ' + region + ' ' + city;
    insertIps(ipv4, currentTime, location);
}

function handleLogin(socket) {
    // 登录
    socket.on('login', ({ account, passwd }) => {
        const condition = `UserName='${account}'`;
        getAllRecordsByCondition(Table_User_Info, condition).then(res => {
            if (res.length === 1) {
                const user = res[0];
                verifyPassword(passwd, user.Salt, user.Iterations, user.PasswordHash).then(res => {
                    if (res) {
                        socket.emit('login_resp', account);
                        // 生成Token
                        const token = generateToken(payload, secretKey);
                        socket.emit('token', token);
                    }
                    else {
                        socket.emit('login_resp', false);
                    }
                });
            }
        })
    });

    socket.on('verifyToken', (token) => {
        const result = verifyToken(token, secretKey);
        if (!result.isValid) {
            console.error('Token is invalid. Error:', result.error);
        }
        socket.emit('token_valid', result.isValid);
    });

    socket.on("signup", (data) => {
        if (data.account) {
            const condition = `UserName='${data.account}'`;
            getAllRecordsByCondition(Table_User_Info, condition).then(res => {
                if (res.length > 0) {
                    console.log(`用户账号${data.account}已存在`);
                    socket.emit('account_existed', data.account);
                }
                else if (res.length === 0) {
                    generateHashedPassword(data.passwd).then(({ hashedPassword, salt, iterations }) => {
                        const recordToInsert = {
                            Username: data.account,
                            PasswordHash: hashedPassword,
                            Salt: salt,
                            Iterations: iterations,
                        };
                        insertRecord(Table_User_Info, recordToInsert)
                            .then((lastID) => {
                                console.log(`成功注册${data.account}，插入的记录 ID 为: ${lastID}`);
                                socket.emit("signup_ok", (data));
                            })
                            .catch((error) => {
                                console.error(`注册${data.account}失败:`, error);
                                socket.emit("signup_failed", (data));
                            });
                    });
                }
            }).catch(e => {
                generateHashedPassword(data.passwd).then(({ hashedPassword, salt, iterations }) => {
                    const recordToInsert = {
                        Username: data.account,
                        PasswordHash: hashedPassword,
                        Salt: salt,
                        Iterations: iterations,
                    };
                    insertRecord(Table_User_Info, recordToInsert)
                        .then((lastID) => {
                            console.log(`成功注册${data.account}，插入的记录 ID 为: ${lastID}`);
                            socket.emit("signup_ok", (data));
                        })
                        .catch((error) => {
                            console.error(`注册${data.account}失败:`, error);
                            socket.emit("signup_failed", (data));
                        });
                });
            });
        }
    });

    socket.on("deleteAccount", (userName) => {
        if (userName) {
            if (userName === 'admin') {
                return;
            }
            deleteRecordByCondition(Table_User_Info, `UserName='${userName}'`);
        }
    });
}

function handleOther(socket) {
    // 发送数据库数据
    socket.on('fetchTable', (tableName) => {
        sendTableData(tableName, socket);
    });

    // 监听用户发布广播消息
    socket.on('publishPublicMsg', (msg) => {
        publicMsgs.push(msg);
        socket.broadcast.emit('publicMsg', msg); // 发送给除发送方以外的所有 socket
        if (publicMsgs.length > PublicMsg_Max_Length) {
            publicMsgs = publicMsgs.slice(publicMsgs.length / 2); // 截取数组的前一半元素
        }
    });

    socket.on("getFormatDate", () => {
        const strDate = getformatNowTime();
        socket.emit('formatDateGot', strDate);
    });
}

function handleDisconnect(socket) {
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
}

const meetRooms = new Map();

const generateMeetRoomId = (socketId) => {
    const combinedSocketId = `${socketId}`;
    const hash = crypto.createHash('sha256');
    hash.update(combinedSocketId);
    const hashedSocketId = hash.digest('hex');
    return hashedSocketId.slice(0, 12);
};

function getMeetRoom(socket) {
    const otherRooms = getSocketRoomsExcludeSelf(socket);
    if (otherRooms.length === 0) {
        return null;
    }
    const rid = otherRooms[0];
    const room = meetRooms.get(rid);
    return room;
}

function leaveRoom(socket, rid) {
    socket.leave(rid);
}

function releaseResource(socket, room) {
    let producerIdSet = new Set();
    // 己方producer
    if (room?.producers?.has(socket.id)) {
        const producerSet = room.producers.get(socket.id);
        for (const producer of producerSet) {
            producer.close();
            producerIdSet.add(producer.id);
        }
        room.producers.delete(socket.id);
    }
    // 己方consumer
    if (room?.consumers?.has(socket.id)) {
        const consumerMap = room.consumers.get(socket.id);
        for (const producerId of consumerMap.keys()) {
            const consumer = consumerMap.get(producerId);
            consumer.close();
            consumerMap.delete(producerId);
        }
        room.consumers.delete(socket.id);
    }

    // 其他consumer
    if (room?.consumers && producerIdSet) {
        for (const consumerMap of room.consumers.values()) {
            for (const producerId of consumerMap.keys()) {
                if (producerIdSet.has(producerId)) {
                    const consumer = consumerMap.get(producerId);
                    consumer.close();
                    consumerMap.delete(producerId);
                }
            }
        }
    }

    if (room?.producerTransports?.has(socket.id)) {
        const producerTransport = room.producerTransports.get(socket.id);
        producerTransport.close();
        room.producerTransports.delete(socket.id);
    }
    if (room?.consumerTransports?.has(socket.id)) {
        const consumerTransport = room.consumerTransports.get(socket.id);
        consumerTransport.close();
        room.consumerTransports.delete(socket.id);
    }
    // room.producers?.delete(socket.id);
    // room.consumers?.delete(socket.id);
    // room.producerTransports?.delete(socket.id);
    // room.consumerTransports?.delete(socket.id);
}

function handleMeet(socket) {
    socket.on("createMeetRoom", async () => {
        let rid = generateMeetRoomId(socket.id);
        const mediasoupRouter = await createWorker();
        const room = {
            id: rid,
            router: mediasoupRouter,
            producerTransports: new Map(), // Map to store transports for each peer.
            // { socket.id: ProducerTransport }
            consumerTransports: new Map(), // Map to store transports for each peer.
            // { socket.id: ConsumerTransport }
            producers: new Map(),  // Map to store producers for each peer.
            // { socket.id: producerSet }
            consumers: new Map()   // Map to store consumers for each peer.
            // { socket.id:consumerMap{ producer.id, Consumer } }
        };
        meetRooms.set(rid, room);
        await socket.join(rid);
        socket.emit("meetRoomCreated", rid);
    });

    socket.on("enterMeetRoom", async (data) => {
        let rid = data;
        const lastRoom = getMeetRoom(socket);
        if (lastRoom) {
            leaveRoom(socket, lastRoom.id);
        }
        else if (!meetRooms.has(rid)) {
            const mediasoupRouter = await createWorker();
            const newRoom = {
                id: rid,
                router: mediasoupRouter,
                producerTransports: new Map(),
                consumerTransports: new Map(),
                producers: new Map(),
                consumers: new Map()
            };
            meetRooms.set(rid, newRoom);
        }
        await socket.join(rid);
        socket.emit("meetRoomEntered", rid);
    });

    socket.on("getRouterRtpCapabilities", () => {
        const room = getMeetRoom(socket);
        if (room?.router) {
            socket.emit("routerRtpCapabilities", room.router.rtpCapabilities);
        }
    });

    socket.on("createProducerTransport", async (msg) => {
        try {
            const room = getMeetRoom(socket);
            if (room?.router) {
                const { transport, params } = await createWebrtcTransport(room.router);
                room.producerTransports.set(socket.id, transport);
                socket.emit("producerTransportCreated", params);
            }
        } catch (error) {
            console.error(error);
        }
    });

    socket.on("connectProducerTransport", async (data) => {
        try {
            const room = getMeetRoom(socket);
            if (!room.producerTransports.has(socket.id)) return;
            const producerTransport = room.producerTransports.get(socket.id);
            await producerTransport.connect({ dtlsParameters: data });
            socket.emit("producerConnected");
        } catch (error) {
            console.error(error);
        }
    });

    socket.on("produce", async (data) => {
        const { kind, rtpParameters } = data;
        const room = getMeetRoom(socket);
        if (!room.producerTransports.has(socket.id)) return;
        const producerTransport = room.producerTransports.get(socket.id);
        let producer = await producerTransport.produce({ kind, rtpParameters });
        let producerSet;
        if (room.producers.has(socket.id)) {
            producerSet = room.producers.get(socket.id);
        }
        else {
            producerSet = new Set();
            room.producers.set(socket.id, producerSet);
        }
        producerSet.add(producer);
        socket.emit("produced", producer.id);
        socket.broadcast.emit('newProducer');
    });

    socket.on("createConsumerTransport", async (msg) => {
        try {
            const room = getMeetRoom(socket);
            const mediasoupRouter = room?.router;
            const { transport, params } = await createWebrtcTransport(mediasoupRouter);
            room.consumerTransports.set(socket.id, transport);
            // const { transport, params } = await createWebrtcTransport(mediasoupRouter);
            // consumerTransport = transport;
            socket.emit("consumerTransportCreated", params);
        } catch (error) {
            console.error(error);
        }
    });

    socket.on("connectConsumerTransport", async (data) => {
        try {
            const room = getMeetRoom(socket);
            if (!room.consumerTransports.has(socket.id)) return;
            const consumerTransport = room.consumerTransports.get(socket.id);
            await consumerTransport.connect({ dtlsParameters: data.dtlsParameters });
            socket.emit("consumerConnected");
        } catch (error) {
            console.error(error);
        }
    });

    socket.on("resume", async (socketId) => {
        try {
            const room = getMeetRoom(socket);
            if (room.consumers.size === 0) return;
            for (const consumerMap of room.consumers.values()) {
                if (consumerMap.size === 0) continue;
                for (const consumer of consumerMap.values()) {
                    await consumer.resume();
                }
            }
            socket.emit("resumed");
        } catch (error) {
            console.error(error);
        }
    });

    socket.on("consume", async (data) => {
        const room = getMeetRoom(socket);
        const mediasoupRouter = room.router;
        let ress = [];
        if (room.producers.size === 0) return;
        for (const sid of room.producers.keys()) {
            if (sid === socket.id) {
                continue;
            }
            const producerSet = room.producers.get(sid);
            let consumers = [];
            for (const producer of producerSet) {
                const res = await createConsumer(mediasoupRouter, producer, data, socket, sid);
                consumers.push(res);
            }
            if (consumers.length > 0) {
                ress.push(consumers);
            }
        }
        socket.emit("subscribed", ress);
    });

    socket.on("consumeNewProducer", async (data) => {
        const room = getMeetRoom(socket);
        if (!room) return;
        const mediasoupRouter = room.router;
        let ress = [];
        if (room.producers.size !== 0) {
            const consumerMap = room.consumers.get(socket.id);
            for (const sid of room.producers.keys()) {
                if (sid === socket.id) {
                    continue;
                }
                const producerSet = room.producers.get(sid);
                let consumers = [];
                for (const producer of producerSet) {
                    let isExist = false;
                    if (consumerMap) {
                        for (const producerId of consumerMap.keys()) {
                            if (producer.id === producerId) {
                                isExist = true;
                                break;
                            }
                        }
                    }
                    if (isExist) {
                        continue;
                    }
                    const res = await createConsumer(mediasoupRouter, producer, data, socket, sid);
                    consumers.push(res);
                }
                if (consumers.length > 0) {
                    ress.push(consumers);
                }
            }
        }
        socket.emit("newProducerConsumed", ress);
    });

    socket.on("leaveMeetRoom", (sid) => {
        const currRoom = getMeetRoom(socket);
        if (currRoom) {
            releaseResource(socket, currRoom);
            io.to(currRoom.id).emit('meetRoomLeft', sid);
            leaveRoom(socket, currRoom.id);
        }
    });

    socket.on('disconnecting', () => {
        const currRoom = getMeetRoom(socket);
        if (currRoom) {
            releaseResource(socket, currRoom);
            io.to(currRoom.id).emit('meetRoomLeft', socket.id);
            leaveRoom(socket, currRoom.id);
        }
    });

    socket.on('disconnect', () => {
        // TODO:销毁房间
    });
}

const createConsumer = async (mediasoupRouter, producer, rtpCapabilities, socket, peerId) => {
    if (!producer) {
        return;
    }
    if (!mediasoupRouter.canConsume({
        producerId: producer.id,
        rtpCapabilities,
    })) {
        console.error("can't consume");
        return;
    }
    let consumer;
    try {
        const room = getMeetRoom(socket);
        if (!room.consumerTransports.has(socket.id)) return;
        const consumerTransport = room.consumerTransports.get(socket.id);
        consumer = await consumerTransport.consume({
            producerId: producer.id,
            rtpCapabilities,
            paused: producer.kind === 'video',
        });
        let consumerMap;
        if (room.consumers.has(socket.id)) {
            consumerMap = room.consumers.get(socket.id);
        }
        else {
            consumerMap = new Map();
            room.consumers.set(socket.id, consumerMap);
        }
        consumerMap.set(producer.id, consumer);
    } catch (error) {
        console.error(error);
        return;
    }
    return {
        peerId: peerId,/** */
        producerId: producer.id,
        id: consumer.id,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
        type: consumer.type,
        producerPaused: consumer.producerPaused,
    }
}

io.on('connection', socket => {
    // 会议
    handleMeet(socket);

    // 视频通话
    handleVideoChat(socket);

    // 直播
    handleLiveStream(socket);

    // 文件传输
    handleFileUpload(socket);

    // 游戏
    handleGame(socket);

    // 登录系统
    handleLogin(socket);

    // 其他
    handleOther(socket);

    // 断开
    handleDisconnect(socket);

    // 开始
    handleStart(socket);
});


server.listen(5000, () => console.log('server is listening port 5000'));

// 定时检查文件夹大小
function scheduledCheckFolder(folderPath, maxSize, interval) {
    setInterval(() => {
        const folderSize = getFolderSize(folderPath);
        if (folderSize > maxSize) {
            console.log(`Folder size exceeds ${maxSize} bytes. Clearing folder...`);
            clearFolder(folderPath);
        }
    }, interval);
}

const temp_folderPath = 'temp';
const temp_maxFolderSizeBytes = 1024 * 1024 * 1024; // 1GB
const temp_interval = 3600000; // 每小时检查一次（单位：毫秒）
const uploads_folderPath = 'uploads';
const uploads_maxFolderSizeBytes = 1024 * 1024 * 1024; // 1GB
const uploads_interval = 3600000 * 24; // 每天检查一次（单位：毫秒）

function getFolderSize(folderPath) {
    if (!fs.existsSync(folderPath)) {
        return;
    }
    let totalSize = 0;
    const files = fs.readdirSync(folderPath);

    files.forEach(file => {
        const filePath = path.join(folderPath, file);
        const stats = fs.statSync(filePath);
        if (stats.isFile()) {
            totalSize += stats.size;
        }
    });

    return totalSize;
}

function clearFolder(folderPath) {
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
        return;
    }
    const files = fs.readdirSync(folderPath);

    files.forEach(file => {
        const filePath = path.join(folderPath, file);
        fs.unlinkSync(filePath);
    });

    console.log(`Folder ${folderPath} cleared.`);
}

clearFolder(temp_folderPath);
clearFolder(uploads_folderPath);
scheduledCheckFolder(temp_folderPath, temp_maxFolderSizeBytes, temp_interval);
scheduledCheckFolder(uploads_folderPath, uploads_maxFolderSizeBytes, uploads_interval);
console.log('定时清理文件任务已开启...');