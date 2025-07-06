import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  chat: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String },
  mediaUrl: { type: String },
  mediaType: { type: String },
   publicId: { type: String },
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // New field
  seenBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  reactions: [{ user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, emoji: String }],
  deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  isDeletedGlobally: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
},{ timestamps: true });

export default mongoose.model("Message", messageSchema);
