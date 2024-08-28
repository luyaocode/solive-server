// 消息队列服务
import amqp from 'amqplib';
import { io, meetRooms,connectedSockets } from './globals.js';
import { Request_Type } from './def.js';

// 请求样例
const request_template = {
    roomId: 'xxxxxxxx',
    type: Request_Type.LIANMAI,
    from: '',
    to:'',
    content:'',
}

const LIANMAI_QUEUE = 'queue_lianmai_request';

let lianmai_channel;

const initMq = async () => {
    const connection = await amqp.connect('amqp://localhost');
    const channel = await connection.createChannel();
    await channel.assertQueue(LIANMAI_QUEUE, { durable: true });
    lianmai_channel = channel;
    processLianMaiQueue();
}

const processLianMaiQueue = () => {
    console.log('Waiting for messages in %s. To exit press CTRL+C', LIANMAI_QUEUE);
    lianmai_channel.consume(LIANMAI_QUEUE, (msg) => {
        if (msg) {
            const request = JSON.parse(msg?.content);
            console.log(LIANMAI_QUEUE + 'received request:', request);
            if (request?.content) {
                handleLianMaiResponse(request);
            }
            else {
                handleLianMaiRequest(request);
            }
        }
    }, { noAck: true });
};

const handleLianMaiRequest = (request) => {
    switch (request?.type) {
        case Request_Type.LIANMAI:
            const { roomId } = request;
            const room = meetRooms?.get(roomId);
            const anchorSocketId = room?.creator;
            const anchorSocket = connectedSockets[anchorSocketId];
            anchorSocket?.emit("request",request);
            break;
        case Request_Type.LIANMAI_EXIT:
            handleExitLianMai(request);
            break;
        default:
            console.log("Unknown request type.")
            break;
    }
};

const handleExitLianMai = (request) => {
    const { roomId, from } = request;
    const socket = connectedSockets[from];
    const room = meetRooms?.get(roomId);
    if (socket&&room) {
        import('../../server.js').then(module => {
            module.releaseProducer(socket,room);
        });
        io.to(room.id).emit('lianMaiExited', socket.id);
    }
}

const handleLianMaiResponse = (request) => {
    const { to } = request;
    const viewerSocket = connectedSockets[to];
    viewerSocket?.emit("response",request);
};

const sendToLianMaiQueue = async (message) => {
    lianmai_channel.sendToQueue(LIANMAI_QUEUE, Buffer.from(JSON.stringify(message)));
};

export { initMq,sendToLianMaiQueue}
