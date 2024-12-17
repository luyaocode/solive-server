import * as os from 'os';
import { publicIpv4 } from 'public-ip';

export function isJSON(str) {
    try {
        JSON.parse(str);
        return true;
    } catch (e) {
        return false;
    }
}

export async function getAnnouncedIp(){
    if (process.env.NODE_ENV === 'dev') {
        return getLocalIP();
    }
    else if (process.env.NODE_ENV === 'prod') {
        return await getPublicIp();
    }
}

async function getPublicIp() {
    try {
        const ip = await publicIpv4();
        console.log('Public IP Address:', ip);
        return ip;
    } catch (error) {
        console.error('Error:', error.message);
        return '127.0.0.1';
    }
}

export function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const interfaceName in interfaces) {
        const addresses = interfaces[interfaceName];
        for (let i = 0; i < addresses.length; i++) {
            const address = addresses[i];
            if (address.family === 'IPv4' && !address.internal) {
                console.log(`Interface: ${interfaceName} IP Address: ${address.address}`);
                return address.address;
            }
        }
    }
    return '127.0.0.1'; // 如果没有找到外部IP，返回回环地址
}
