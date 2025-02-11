import {
    Liquidity,
    LiquidityPoolKeys,
    Market,
    TokenAccount,
    SPL_ACCOUNT_LAYOUT,
    publicKey,
    struct,
    MAINNET_PROGRAM_ID,
    LiquidityStateV4,
    TOKEN_PROGRAM_ID,
} from '@raydium-io/raydium-sdk';
import { Commitment, Connection, PublicKey } from '@solana/web3.js';

export const RAYDIUM_LIQUIDITY_PROGRAM_ID_V4 = MAINNET_PROGRAM_ID.AmmV4;
export const OPENBOOK_PROGRAM_ID = MAINNET_PROGRAM_ID.OPENBOOK_MARKET;

export const MINIMAL_MARKET_STATE_LAYOUT_V3 = struct([
    publicKey('eventQueue'),
    publicKey('bids'),
    publicKey('asks'),
]);

export async function getTokenAccounts(
    connection: Connection,
    owner: PublicKey,
    commitment?: Commitment,
) {
    const tokenResp = await connection.getTokenAccountsByOwner(
        owner,
        {
            programId: TOKEN_PROGRAM_ID,
        },
        commitment,
    );

    const accounts: TokenAccount[] = [];
    for (const { pubkey, account } of tokenResp.value) {
        accounts.push({
            pubkey,
            programId: account.owner,
            accountInfo: SPL_ACCOUNT_LAYOUT.decode(account.data),
        });
    }

    return accounts;
}
