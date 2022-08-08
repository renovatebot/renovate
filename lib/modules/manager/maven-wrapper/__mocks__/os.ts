import * as osOrignal  from 'os';

type MockOs = {
    __setPlatform: (platform: NodeJS.Platform) => void;
}

let mockPlatform : NodeJS.Platform = 'darwin';
const os : (typeof osOrignal & MockOs) = jest.createMockFromModule('os');

function platform() {
    return mockPlatform
}

function cpus() {
    return [];
}

os.platform = platform;
os.cpus = cpus;
os.__setPlatform = (platform: NodeJS.Platform) => mockPlatform = platform;

module.exports = os;
