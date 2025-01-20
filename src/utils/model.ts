import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
    mint: { type: String, required: true },
    poolId: { type: String, required: true },
    tokenAmount: { type: String, default: "" },
    status: { type: Number, default: 0 }
});

const UserModel = mongoose.model("snipedList", UserSchema);

export default UserModel;