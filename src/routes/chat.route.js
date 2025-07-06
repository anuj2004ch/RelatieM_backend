import express from "express";
import {
  createOrGetChat,
  createGroupChat,
  sendMessage,
  getMessages,
  addGroupMember,
  removeGroupMember,
  deleteMessage
} from "../controllers/chat.controller.js";
import {protectRoute} from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protectRoute);
router.post("/",createOrGetChat);

// Create group chat
router.post("/group", createGroupChat);

// Add member to group (admin only)
router.put("/group/add",addGroupMember);

// Remove member from group (admin only)
router.put("/group/remove",removeGroupMember);

// Send message (text/media)
router.post("/message",sendMessage);

// Get messages for a chat
router.get("/messages/:chatId",  getMessages);
router.delete("/messages/:messageId",deleteMessage);

export default router;
