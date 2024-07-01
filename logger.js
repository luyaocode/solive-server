// 日志模块
import winston from 'winston';
import fs from 'fs';

const LOG_DIRECTORY = './log';
export async function createLogger(processName = 'default') {
    if (!fs.existsSync(LOG_DIRECTORY)) {
        fs.mkdirSync(LOG_DIRECTORY, { recursive: true });
    }
    const errorTransport = new winston.transports.File({
        filename: `${LOG_DIRECTORY}/error_${processName}.log`,
        level: 'error'
    });
    const combinedTransport = new winston.transports.File({
        filename: `${LOG_DIRECTORY}/combined_${processName}.log`
    });

    const logger = winston.createLogger({
        level: 'info',
        format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.printf(({ timestamp, level, message }) => {
                return `${timestamp} [${level.toUpperCase()}]: ${message}`;
            })
        ),
        transports: [
            errorTransport,
            combinedTransport,
            new winston.transports.Console()
        ]
    });
    return logger;
}