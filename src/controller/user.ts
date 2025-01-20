import UserModel from "../utils/model";

// Function to get all user data
export const getAllSnipedList = async () => {
    try {
        // Fetch all documents in the collection
        const snipedList = await UserModel.find({});
        console.log("All Users:", snipedList);
        return snipedList;
    } catch (error) {
        console.error("Error fetching users:", error);
        throw error;
    }
};

export const saveNewSnipedToken = async (mint: string, poolId: string, tokenAmount: string) => {
    try {
        // Check if a document with the same poolId already exists
        const existingUser = await UserModel.findOne({ poolId: poolId });

        if (existingUser) {
            console.log(`Document with poolId "${poolId}" already exists. No new data will be saved.`);
            return; // Exit the function if the document already exists
        }

        // If the poolId does not exist, save the new document
        const newUser = new UserModel({
            mint: mint,
            poolId: poolId,
            tokenAmount: tokenAmount
        });

        await newUser.save();
        console.log(`New document with poolId "${poolId}" has been saved.`);
    } catch (error) {
        console.error("Error saving new sniped Token:", error);
        throw error;
    }
};

export const deleteSnipedToken = async (poolId: string) => {
    try {
        const result = await UserModel.deleteOne({ poolId: poolId });
        console.log("Delete PoolId:", result);
    } catch (error) {
        console.error("Error deleting sniped Token:", error);
        throw error;
    }
};

export const updateSnipedToken = async (poolId: string, tokenAmount: string) => {
    try {
        // Update the status of the document with the given poolId
        const result = await UserModel.updateOne(
            { poolId: poolId }, // Filter condition
            { $set: { status: 1, tokenAmount: tokenAmount } } // Update operation
        );

        if (result.matchedCount === 0) {
            console.log(`No found with poolId "${poolId}".`);
        } else {
            console.log(`Status updated for document with poolId "${poolId}".`);
        }
    } catch (error) {
        console.error("Error updating status:", error);
        throw error;
    }
}