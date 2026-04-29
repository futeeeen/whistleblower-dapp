const { Identity } = require("@semaphore-protocol/identity");

const identity = new Identity();

console.log("privateKey(base64):", identity.export());
console.log("commitment:", identity.commitment.toString());
