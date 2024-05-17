var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import * as mediasoup from 'mediasoup';
import { config } from './config.js';
const worker = [];
let nextMediasoupWorkerIdx = 0;
const createWorker = () => __awaiter(void 0, void 0, void 0, function* () {
    const worker = yield mediasoup.createWorker({
        logLevel: config.mediasoup.worker.logLevel,
        logTags: config.mediasoup.worker.logTags,
        rtcMinPort: config.mediasoup.worker.rtcMinPort,
        rtcMaxPort: config.mediasoup.worker.rtcMaxPort,
    });
    worker.on('died', () => {
        console.error('mediasoup worker died, exiting in 2 seconds...  [pid:&d]', worker.pid);
        setTimeout(() => {
            process.exit(1);
        }, 2000);
    });
    const mediaCodecs = config.mediasoup.router.mediaCodes;
    const mediasoupRouter = yield worker.createRouter({ mediaCodecs });
    return mediasoupRouter;
});
const createWebrtcTransport = (mediasoupRouter) => __awaiter(void 0, void 0, void 0, function* () {
    const { maxIncomeBitrate, initialAvailableOutgoingBitrate, } = config.mediasoup.webRtcTransport;
    const transport = yield mediasoupRouter.createWebRtcTransport({
        listenIps: config.mediasoup.webRtcTransport.listenIps,
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
        initialAvailableOutgoingBitrate,
    });
    if (maxIncomeBitrate) {
        try {
            yield transport.setMaxIncomingBitrate(maxIncomeBitrate);
        }
        catch (error) {
            console.error(error);
        }
    }
    return {
        transport,
        params: {
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidate: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters,
        }
    };
});
export { createWorker, createWebrtcTransport, };
