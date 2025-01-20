import { struct, u8, u64, publicKey } from "@raydium-io/raydium-sdk";

export const LOG_TYPE = struct([u8("log_type")]);

export const RAY_IX_TYPE = {
    CREATE_POOL: 0,
    ADD_LIQUIDITY: 1,
    BURN_LIQUIDITY: 2,
    SWAP: 3,
};

export interface User {
    id: number;
    username: string;
    wallets: Wallet[];
    snipeList: TokenList[];
    tokenAddr: string;
}

export interface Wallet {
    privateKey: string;
    publicKey: string;
}

export interface TokenList {
    mint: string;
    poolId: string;
}

// Define the structure for `ParsedAccountData`
export interface ParsedMintInfo {
    parsed: {
        info: {
            decimals: number;
            freezeAuthority: string | null;
            isInitialized: boolean;
            mintAuthority: string;
            supply: string;
        };
        type: string;
    };
    program: string;
    space: number;
}