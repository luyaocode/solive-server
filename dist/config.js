import * as os from 'os';
import { getLocalIP } from "../plugins.js";
const localIP = getLocalIP();
export const config = {
    listenIp: '0.0.0.0',
    listenPort: 3016,
    mediasoup: {
        numWorkers: Object.keys(os.cpus()).length,
        worker: {
            rtcMinPort: 10000,
            rtcMaxPort: 11000,
            logLevel: 'debug',
            logTags: [
                'info',
                'ice',
                'dtls',
                'rtp',
                'srtp',
                'rtcp',
            ],
        },
        router: {
            mediaCodes: [
                {
                    kind: 'audio',
                    mimeType: 'audio/opus',
                    clockRate: 48000,
                    channels: 2,
                }, {
                    kind: 'video',
                    mimeType: 'video/VP8',
                    clockRate: 90000,
                    parameters: {
                        'x-google-start-bitrate': 1000,
                    }
                }
            ],
        },
        // webrtctransport settings
        webRtcTransport: {
            listenIps: [
                {
                    ip: '0.0.0.0',
                    announcedIp: localIP,
                    // 如果是本地浏览器之间测试，用127.0.0.1可以，
                    // 如果Windows客户端和浏览器测试，必须用服务器地址，如果服务器在WSL里运行，就是主系统分配的ip地址
                    // 如果上线服务器，就填公网ip地址
                }
            ],
            maxIncomeBitrate: 1500000,
            initialAvailableOutgoingBitrate: 1000000,
        }
    }
};
