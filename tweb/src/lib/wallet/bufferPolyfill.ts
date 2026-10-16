import {Buffer} from 'buffer';

// The TON libraries use Node's Buffer while their own modules are being evaluated, so this has to be the very first
// import of anything that pulls them in.
(globalThis as any).Buffer ??= Buffer;
