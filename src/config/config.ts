import dotenv from "dotenv";
import { logger, retrieveEnvVariable } from "../utils/utils";
import { Connection } from "@solana/web3.js";

dotenv.config();

try {
    dotenv.config();
} catch (error) {
    console.error("Error loading environment variables:", error);
    process.exit(1);
}
export const PRIVATE_KEY = retrieveEnvVariable('PRIVATE_KEY', logger)

export const LOG_LEVEL = retrieveEnvVariable('LOG_LEVEL', logger);
export const CHECK_IF_MINT_IS_RENOUNCED = retrieveEnvVariable('CHECK_IF_MINT_IS_RENOUNCED', logger) === 'true'
export const CHECK_IF_MINT_IS_FROZEN = retrieveEnvVariable('CHECK_IF_MINT_IS_FROZEN', logger) === 'true'
export const CHECK_IF_MINT_IS_BURNED = retrieveEnvVariable('CHECK_IF_MINT_IS_BURNED', logger) === 'true'

export const JITO_FEE = Number(retrieveEnvVariable('JITO_FEE', logger))

export const RPC_ENDPOINT = retrieveEnvVariable('RPC_ENDPOINT', logger);
export const WEBSOCKET_ENDPOINT = retrieveEnvVariable('WEBSOCKET_ENDPOINT', logger);
export const RPC_SUB_ENDPOINT = retrieveEnvVariable('RPC_SUB_ENDPOINT', logger);
export const WEBSOCKET_SUB_ENDPOINT = retrieveEnvVariable('WEBSOCKET_SUB_ENDPOINT', logger);

export const solanaConnection = new Connection(RPC_ENDPOINT, { wsEndpoint: WEBSOCKET_ENDPOINT, commitment: "confirmed" });
export const solanaSubcribeConnection = new Connection(RPC_SUB_ENDPOINT, { wsEndpoint: WEBSOCKET_SUB_ENDPOINT, commitment: "confirmed" });

export const TX_FEE = Number(retrieveEnvVariable('TX_FEE', logger))

export const GENERIC_ERROR_MESSAGE =
    "An error occurred. Please try again later.";