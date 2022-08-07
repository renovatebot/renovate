let mockPlatform = 'darwin';
const os = jest.createMockFromModule('os');

function platform() {
    return mockPlatform
}

function cpus() {
    return [];
}

os.platform = platform;
os.cpus = cpus;
os.__setPlatform = (platform: string) => mockPlatform = platform;

module.exports = os;