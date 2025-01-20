
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import pino, { Logger } from 'pino';
import { solanaConnection } from '../config/config';
import { Wallet } from './type';
import fs from 'fs';

/** Address of the special mint for wrapped native SOL in spl-token */
export const NATIVE_MINT = new PublicKey('So11111111111111111111111111111111111111112');

export const retrieveEnvVariable = (variableName: string, logger: Logger) => {
    const variable = process.env[variableName] || '';
    if (!variable) {
        logger.error(`${variableName} is not set`);
        process.exit(1);
    }
    return variable;
};

export const transport = pino.transport({
    target: 'pino-pretty',
});

export const logger = pino(
    {
        level: 'info',
        redact: ['poolKeys'],
        serializers: {
            error: pino.stdSerializers.err,
        },
        base: undefined,
    },
    transport,
);

export const getBalance = async (publicKey: PublicKey): Promise<number> => {
    const solAmount = (await solanaConnection.getBalance(publicKey)) / LAMPORTS_PER_SOL;
    return solAmount;
};

export const createAccount = async (): Promise<Wallet> => {
    const wallet = Keypair.generate();

    // Convert private key to hex or base58
    const privateKey = Buffer.from(wallet.secretKey).toString('hex'); // Hex encoding for private key
    const publicKey = wallet.publicKey.toBase58(); // Base58 for public key

    return {
        privateKey,
        publicKey
    };
};

// Function to create Keypair from private key in hex format
export const keypairFromPrivateKey = (privateKeyHex: string): Keypair => {
    //Convert the hexadecimal private key to a Uint8Array
    const secretKeyUint8Array = new Uint8Array(
        privateKeyHex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
    );
    const keypair = Keypair.fromSecretKey(secretKeyUint8Array);
    return keypair;
};

// Define the type for the JSON file content
export interface Data {
    privateKey: string;
    pubkey: string;
}

// Function to read JSON file
export function readWalletJson(filename: string = "data.json"): Data[] {
    if (!fs.existsSync(filename)) {
        // If the file does not exist, create an empty array
        fs.writeFileSync(filename, '[]', 'utf-8');
    }
    const data = fs.readFileSync(filename, 'utf-8');
    return JSON.parse(data) as Data[];
}

export const sleep = async (ms: number) => {
    await new Promise((resolve) => setTimeout(resolve, ms))
}

export const validatorTokenAddr = (pupbkey: string) => {
    try {
        new PublicKey(pupbkey)
        return true
    } catch (e) {
        return false
    }
}


export const getTokenInfo = async (tokenAddr: string): Promise<any> => {
    try {
        const res = await fetch(`https://api.pump.fun/v1/tokens/${tokenAddr}`, {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json'
            },
        });
        const data: any = await res.clone().json()
        if (data.pairs.length == 0) {
            return null
        } else {
            const tokenInfo = data.pairs.filter((pair: any) => pair.dexId === "raydium" && pair.quoteToken.address == NATIVE_MINT.toBase58())[0];
            console.log({ tokenInfo })
            return tokenInfo;
        }
    } catch (error) {
        console.error("Error for getting Token Information.", error);
        return null;
    }
};