import Chat from "../models/Chat.js";
import Message from "../models/Message.js";
import User from "../models/User.js";

const users = new Map();        // userId => socketId
const friendsMap = new Map();   // userId => [friendIds]
const typingUsers = new Map();  // userId => Set of userIds they're typing to
const unreadCounts = new Map(); // userId => Map of senderId => count
const chatRooms = new Map();    // chatId => Set of userIds currently in room

export default function socketHandler(io) {
  io.on("connection", (socket) => {
    console.log("🔌 New client connected");

    socket.on("join", async (userId) => {
      if (!userId) {
        socket.emit("auth-error");
        return;
      }

      users.set(userId, socket.id);
      socket.userId = userId;

      try {
        const user = await User.findById(userId).select("friends");
        if (!user) {
          socket.emit("auth-error");
          return;
        }

        const friendIds = user?.friends?.map(id => id.toString()) || [];
        friendsMap.set(userId, friendIds);

        // Initialize unread counts for this user
        await initializeUnreadCounts(userId, friendIds);

        const onlineFriends = friendIds.filter(fid => users.has(fid));
        socket.emit("online-friends", onlineFriends);

        const userUnreadCounts = unreadCounts.get(userId) || new Map();
        const unreadCountsObj = Object.fromEntries(userUnreadCounts);
        socket.emit("unread-counts", unreadCountsObj);

        // Notify friends that this user is online
        onlineFriends.forEach(fid => {
          const fidSocket = users.get(fid);
          if (fidSocket) {
            io.to(fidSocket).emit("friend-status-change", {
              userId,
              status: "online"
            });
          }
        });

        // Notify chat rooms about status change
        await notifyChatRoomsAboutStatusChange(io, userId, "online");
      } catch (err) {
        console.error("🔴 Error in join handler:", err.message);
        socket.emit("error", { message: "Failed to join" });
      }
    });

    socket.on("join-chat", async (chatId) => {
      if (!chatId || !socket.userId) return;
      
      socket.join(chatId);

      // Track users in chat room
      if (!chatRooms.has(chatId)) chatRooms.set(chatId, new Set());
      chatRooms.get(chatId).add(socket.userId);

      try {
        const chat = await Chat.findById(chatId).populate('members', 'name');
        if (!chat) {
          socket.emit("error", { message: "Chat not found" });
          return;
        }

        const onlineMembers = [];
        const offlineMembers = [];

        chat.members.forEach(member => {
          const memberId = member._id.toString();
          if (memberId !== socket.userId) {
            if (users.has(memberId)) {
              onlineMembers.push({ userId: memberId, name: member.name });
            } else {
              offlineMembers.push({ userId: memberId, name: member.name });
            }
          }
        });

        socket.emit("chat-members-status", { chatId, onlineMembers, offlineMembers });
        socket.to(chatId).emit("member-joined-chat", { userId: socket.userId, chatId });
      } catch (err) {
        console.error("🔴 Error in join-chat handler:", err.message);
        socket.emit("error", { message: "Failed to join chat" });
      }
    });

    socket.on("leave-chat", (chatId) => {
      if (!chatId || !socket.userId) return;
      
      socket.leave(chatId);
      
      // Remove user from chat room tracking
      if (chatRooms.has(chatId)) {
        chatRooms.get(chatId).delete(socket.userId);
        if (chatRooms.get(chatId).size === 0) {
          chatRooms.delete(chatId);
        }
      }

      socket.to(chatId).emit("member-left-chat", { userId: socket.userId, chatId });
    });

    socket.on("send-message", async (msgData) => {
      const { chatId, sender, text, mediaUrl, mediaType, publicId } = msgData;
      console.log(msgData);
      
      if (!chatId || !sender || (!text?.trim() && !mediaUrl)) {
        socket.emit("message-error", { message: "Invalid message data" });
        return;
      }

      try {
        const newMsg = new Message({ 
          chat: chatId, 
          sender, 
          text: text?.trim(), 
          mediaUrl, 
          mediaType,
          publicId,
        });
        await newMsg.save();

        const populatedMsg = await Message.findById(newMsg._id)
          .populate('sender', 'name profilePic');

        const chatDoc = await Chat.findById(chatId).populate('members');
        if (!chatDoc) {
          socket.emit("message-error", { message: "Chat not found" });
          return;
        }

        const recipients = chatDoc.members
          .map(m => m._id.toString())
          .filter(id => id !== sender);

        // Update unread counts for recipients not currently in the chat room
        for (const recipientId of recipients) {
          const isRecipientInRoom = chatRooms.get(chatId)?.has(recipientId) || false;
          
          if (!isRecipientInRoom) {
            if (!unreadCounts.has(recipientId)) {
              unreadCounts.set(recipientId, new Map());
            }
            const recipientUnread = unreadCounts.get(recipientId);
            
            // Count actual unread messages from this sender
            const unseenCount = await Message.countDocuments({
              chat: chatId,
              sender,
              readBy: { $ne: recipientId }
            });

            recipientUnread.set(sender, unseenCount);

            // Notify recipient of unread count update
            const recipientSocket = users.get(recipientId);
            if (recipientSocket) {
              io.to(recipientSocket).emit("unread-count-update", {
                senderId: sender,
                count: unseenCount
              });
            }
          }
        }

        // Emit message to all users in the chat room
        io.to(chatId).emit("receive-message", populatedMsg);
        
      } catch (err) {
        console.error("🔴 Error sending message:", err.message);
        socket.emit("message-error", { message: "Failed to send message" });
      }
    });

    socket.on("typing", ({ recipientId, isTyping }) => {
      const userId = socket.userId;
      if (!userId || !recipientId) return;

      const userFriends = friendsMap.get(userId) || [];
      if (!userFriends.includes(recipientId)) return;

      if (!typingUsers.has(userId)) typingUsers.set(userId, new Set());
      const userTypingSet = typingUsers.get(userId);

      if (isTyping) {
        userTypingSet.add(recipientId);
      } else {
        userTypingSet.delete(recipientId);
      }

      const recipientSocket = users.get(recipientId);
      if (recipientSocket) {
        io.to(recipientSocket).emit("user-typing", { userId, isTyping });
      }
    });

    socket.on("typing-in-chat", ({ chatId, isTyping }) => {
      const userId = socket.userId;
      if (!userId || !chatId) return;
      
      socket.to(chatId).emit("user-typing-in-chat", { userId, isTyping, chatId });
    });

    socket.on("mark-as-read", async ({ senderId }) => {
      const userId = socket.userId;
      if (!userId || !senderId) return;

      try {
        // Update database - mark all messages from sender as read
        await Message.updateMany(
          { sender: senderId, readBy: { $ne: userId } },
          { $addToSet: { readBy: userId } }
        );

        // Update in-memory unread counts
        if (unreadCounts.has(userId)) {
          const userUnread = unreadCounts.get(userId);
          userUnread.delete(senderId);
        }

        socket.emit("unread-count-update", { senderId, count: 0 });
      } catch (err) {
        console.error("🔴 Error marking messages as read:", err.message);
        socket.emit("error", { message: "Failed to mark as read" });
      }
    });

    // Add missing message-seen handler
    socket.on("message-seen", async ({ messageId, userId, chatId }) => {
      if (!messageId || !userId || !chatId) return;

      try {
        await Message.findByIdAndUpdate(messageId, {
          $addToSet: { seenBy: userId },
        });
        io.to(chatId).emit("message-seen-update", { messageId, userId });
      } catch (err) {
        console.error("🔴 Error updating message seen status:", err.message);
      }
    });

    // Add missing message-react handler
    socket.on("message-react", async ({ messageId, userId, emoji, chatId }) => {
      if (!messageId || !userId || !emoji || !chatId) return;

      try {
        // Remove existing reaction from this user first
        await Message.findByIdAndUpdate(messageId, {
          $pull: { reactions: { user: userId } }
        });

        // Add new reaction
        await Message.findByIdAndUpdate(messageId, {
          $push: { reactions: { user: userId, emoji } }
        });

        const updatedMsg = await Message.findById(messageId);
        io.to(chatId).emit("reaction-update", {
          messageId,
          reactions: updatedMsg.reactions
        });
      } catch (err) {
        console.error("❌ Error reacting to message:", err.message);
        socket.emit("error", { message: "Failed to add reaction" });
      }
    });

    socket.on("disconnect", () => {
      const userId = socket.userId;
      if (!userId) return;

      console.log(`🔌 User ${userId} disconnected`);
      
      users.delete(userId);
      const friendIds = friendsMap.get(userId) || [];

      
      if (typingUsers.has(userId)) {
        const userTypingSet = typingUsers.get(userId);
        userTypingSet.forEach(recipientId => {
          const recipientSocket = users.get(recipientId);
          if (recipientSocket) {
            io.to(recipientSocket).emit("user-typing", { userId, isTyping: false });
          }
        });
        typingUsers.delete(userId);
      }

      // Remove from all chat rooms
      for (const [chatId, usersInRoom] of chatRooms.entries()) {
        if (usersInRoom.has(userId)) {
          usersInRoom.delete(userId);
          if (usersInRoom.size === 0) {
            chatRooms.delete(chatId);
          }
        }
      }

      // Notify friends about offline status
      friendIds.forEach(fid => {
        const fidSocket = users.get(fid);
        if (fidSocket) {
          io.to(fidSocket).emit("friend-status-change", {
            userId,
            status: "offline"
          });
        }
      });

      // Notify chat rooms about offline status
      notifyChatRoomsAboutStatusChange(io, userId, "offline");
      
      friendsMap.delete(userId);
      unreadCounts.delete(userId);
    });

    // Add error handling for invalid events
    socket.on("error", (error) => {
      console.error("🔴 Socket error:", error);
    });
  });
}

async function notifyChatRoomsAboutStatusChange(io, userId, status) {
  try {
    const userChats = await Chat.find({ members: userId });
    userChats.forEach(chat => {
      const chatId = chat._id.toString();
      io.to(chatId).emit("chat-member-status-change", { userId, status, chatId });
    });
  } catch (err) {
    console.error("🔴 Error notifying chat rooms about status change:", err.message);
  }
}

async function initializeUnreadCounts(userId, friendIds) {
  try {
    const userChats = await Chat.find({ 
      members: userId, 
      isGroup: false 
    }).populate('members');
    
    const userUnreadMap = new Map();

    for (const chat of userChats) {
      const otherMember = chat.members.find(m => m._id.toString() !== userId);
      if (!otherMember || !friendIds.includes(otherMember._id.toString())) continue;

      const unreadCount = await Message.countDocuments({
        chat: chat._id,
        sender: otherMember._id,
        readBy: { $ne: userId }
      });

      if (unreadCount > 0) {
        userUnreadMap.set(otherMember._id.toString(), unreadCount);
      }
    }

    unreadCounts.set(userId, userUnreadMap);
  } catch (err) {
    console.error("🔴 Error initializing unread counts:", err.message);
  }
}