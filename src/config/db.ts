import mongoose from "mongoose";
import { logger } from "../utils/utils";

/**
 * Establishes a connection to the MongoDB database.
 *
 * This function sets up a connection to the MongoDB database using the provided `MONGO_URL` configuration.
 * It enforces strict query mode for safer database operations. Upon successful connection, it logs the
 * host of the connected database. In case of connection error, it logs the error message and exits the process.
 */
export const connectMongoDB = async () => {
    let isConnected = false;
    const mongoUri = process.env.MONGODB_URI as string;

    const connect = async () => {
        try {
            if (mongoUri) {
                const connection = await mongoose.connect(mongoUri);
                logger.info(`Connected to MongoDB`);
                isConnected = true;
            } else {
                logger.info("No Mongo URL");
            }
        } catch (error) {
            logger.error(`Error : ${(error as Error).message}`);
            isConnected = false;
            // Attempt to reconnect
            setTimeout(connect, 1000); // Retry connection after 1 seconds
        }
    };

    await connect();

    mongoose.connection.on("disconnected", () => {
        logger.error("MONGODB DISCONNECTED");
        isConnected = false;
        // Attempt to reconnect
        setTimeout(connect, 1000); // Retry connection after 5 seconds
    });

    mongoose.connection.on("reconnected", () => {
        logger.info("MONGODB RECONNECTED");
        isConnected = true;
    });
};