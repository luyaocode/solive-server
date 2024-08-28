import * as socket from 'socket.io';
// import WebSocket from 'ws';
// const socket = WebSocket;
let io;
const setIo = (server) => {
    io = new socket.Server(server, {
        cors: {
            origin: '*',
            methods: ["GET", "POST"]
        }
    });
}

const meetRooms = new Map(); // 会议12位号码，直播8位号码
// template
const room = {
    creator:"", // 创建者
    id: "", // 房间号
    router: {},
    producerTransports: new Map(), // Map to store transports for each peer.
    // { socket.id: ProducerTransport }
    consumerTransports: new Map(), // Map to store transports for each peer.
    // { socket.id: ConsumerTransport }
    producers: new Map(),  // Map to store producers for each peer.
    // { socket.id: producerSet }
    consumers: new Map()   // Map to store consumers for each peer.
    // { socket.id:consumerMap{ producer.id, Consumer } }
};
const connectedSockets = {} ;
export { io,setIo,meetRooms,connectedSockets }
