import * as os from 'os';
export const config = {
    listenIp: '0.0.0.0',
    listenPort: 3016,
    mediasoup: {
        numWorkers: Object.keys(os.cpus()).length,
        worker: {
            rtcMinPort: 20000,
            rtcMaxPort: 20100,
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
                    announcedIp: '127.0.0.1', // replace by public IP address
                }
            ],
            maxIncomeBitrate: 1500000,
            initialAvailableOutgoingBitrate: 1000000,
        }
    }
};
