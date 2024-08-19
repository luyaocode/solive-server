import * as os from 'os';

export function isJSON(str) {
    try {
        JSON.parse(str);
        return true;
    } catch (e) {
        return false;
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
