import WebSocket from 'ws';

// 创建一个WebSocket对象并连接到服务器
const ws = new WebSocket('wss://api.chaosgomoku.fun:443');

// 连接成功时触发
ws.onopen = function(event) {
    console.log('Connected to WebSocket server.');
    // 发送一条消息到服务器
    ws.send('Hello Server!');
};

// 连接关闭时触发
ws.onclose = function(event) {
    console.log('Disconnected from WebSocket server.');
};

// 收到服务器消息时触发
ws.onmessage = function(event) {
    console.log('Received message from server:', event.data);
};

// 发生错误时触发
ws.onerror = function(error) {
    console.error('WebSocket error:', error);
};

// 向服务器发送消息的函数
function sendMessage(message) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
    } else {
        console.error('WebSocket is not open. Ready state:', ws.readyState);
    }
}
