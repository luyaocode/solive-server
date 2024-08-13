import * as os from 'os';
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
                    announcedIp: '127.0.0.1', // replace by public IP address
                }
            ],
            listenInfos :
            [
              {
                protocol : 'udp',
                ip       : '127.0.0.1',
              },
              {
                protocol : 'tcp',
                ip       : '127.0.0.1',
              }
            ],
            maxIncomeBitrate: 1500000,
            initialAvailableOutgoingBitrate: 1000000,
        }
    }
};
