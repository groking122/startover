// Setup browser environment globals that are used in the verify signature function
global.TextEncoder = class {
  encode(text) {
    return Buffer.from(text);
  }
};

// Mock any other global browser APIs used in our tests 