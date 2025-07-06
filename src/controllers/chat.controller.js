import Chat from "../models/Chat.js";
import Message from "../models/Message.js";
import User from "../models/User.js"; // Optional: for population
import cloudinary from "../lib/cloudinary.js";

export const createOrGetChat = async (req, res) => {
  try {
    const { otherUserId } = req.body;
    

    const existingChat = await Chat.findOne({
      isGroup: false,
      members: { $all: [req.user.id, otherUserId] },
    }).populate("members", "-password");

    if (existingChat) return res.json(existingChat);

    const newChat = await Chat.create({
      members: [req.user.id, otherUserId],
      isGroup: false,
    });

    const populatedChat = await Chat.findById(newChat._id).populate("members", "-password");
    res.status(201).json(populatedChat);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error creating chat" });
  }
};

export const createGroupChat = async (req, res) => {
  try {
    const { chatName, members } = req.body;

    if (!chatName || !members || members.length < 2) {
      return res.status(400).json({ error: "Group must have a name and at least 2 users" });
    }

    members.push(req.user._id); 

    const groupChat = await Chat.create({
      chatName,
      members,
      isGroup: true,
      admin: req.user._id,
    });

    const populatedChat = await groupChat.populate("members", "-password");
    res.status(201).json(populatedChat);
  } catch (error) {
    res.status(500).json({ error: "Failed to create group chat" });
  }
};

// ✅ Send message
export const sendMessage = async (req, res) => {
  try {
    console.log(req.body);
    const { chatId, text, mediaUrl, mediaType } = req.body;

    const newMessage = await Message.create({
      chat: chatId,
      sender: req.user.id,
      text,
      mediaUrl,
      mediaType,
    });


    // const populatedMessage = await newMessage
    //   .populate("sender", "fullName profilePic")
    //   .populate("chat");


    res.status(201).json(newMessage);
    
  } catch (error) {
    res.status(500).json({ error: "Failed to send message" });
  }
};

// ✅ Get messages for a chat
export const getMessages = async (req, res) => {
  try {
    const { chatId } = req.params;

    const messages = await Message.find({ chat: chatId })
      .sort({ createdAt: 1 })
      .populate("sender", "fullName profilePic");

    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch messages" });
  }
};

// ✅ Add member to group (admin only)
export const addGroupMember = async (req, res) => {
  try {
    const { chatId, userId } = req.body;

    const chat = await Chat.findById(chatId);
    if (!chat || !chat.isGroup) {
      return res.status(404).json({ error: "Group chat not found" });
    }

    if (!chat.admin.equals(req.user._id)) {
      return res.status(403).json({ error: "Only group admin can add members" });
    }

    if (chat.members.includes(userId)) {
      return res.status(400).json({ error: "User is already a member" });
    }

    chat.members.push(userId);
    await chat.save();

    const updatedChat = await chat.populate("members", "-password");
    res.json(updatedChat);
  } catch (error) {
    res.status(500).json({ error: "Failed to add member to group" });
  }
};

// ✅ Remove member from group (admin only)
export const removeGroupMember = async (req, res) => {
  try {
    const { chatId, userId } = req.body;

    const chat = await Chat.findById(chatId);
    if (!chat || !chat.isGroup) {
      return res.status(404).json({ error: "Group chat not found" });
    }

    if (!chat.admin.equals(req.user._id)) {
      return res.status(403).json({ error: "Only group admin can remove members" });
    }

    chat.members = chat.members.filter(
      (memberId) => memberId.toString() !== userId
    );
    await chat.save();

    const updatedChat = await chat.populate("members", "-password");
    res.json(updatedChat);
  } catch (error) {
    res.status(500).json({ error: "Failed to remove member from group" });
  }
};
export const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { deleteType } = req.body;
    const senderId = req.user.id; // 
    
    const message = await Message.findById(messageId).populate('chat');

    if (!message) {
      return res.status(404).json({ message: "Message not found." });
    }

    const chat = message.chat;

    
    const isMember = chat.members.some(member => member._id.toString() === senderId);
    if (!isMember) {
        return res.status(403).json({ message: "You are not a member of this chat." });
    }

    
    if (deleteType === 'everyone') {
      
      if (message.sender.toString() !== senderId) {
          return res.status(403).json({ message: "You can only delete your own messages for everyone." });
      }

      const seenByUserIds = message.seenBy.map(id => id.toString());
      let canDeleteForEveryone = false;

      if (chat.isGroup) {

        const otherMemberIds = chat.members
          .map(member => member._id.toString())
          .filter(id => id !== senderId);
        
        const hasBeenSeenByOthers = otherMemberIds.some(memberId => seenByUserIds.includes(memberId));

        if (!hasBeenSeenByOthers) {
          canDeleteForEveryone = true;
        }
      } else {
        
        const recipient = chat.members.find(member => member._id.toString() !== senderId);

       
        if (recipient && !seenByUserIds.includes(recipient._id.toString())) {
          canDeleteForEveryone = true;
        } else if (!recipient) {
         
          canDeleteForEveryone = true;
        }
      }

      if (canDeleteForEveryone) {
        let resourceType = 'raw'; // default

    if (message.mediaType) {
  if (message.mediaType.startsWith('image/')) resourceType = 'image';
  else if (message.mediaType.startsWith('video/')) resourceType = 'video';
}

       if (message.publicId) {
  try {
    await cloudinary.uploader.destroy(message.publicId, {
      resource_type: resourceType,
    });
    message.publicId = null;
    console.log('Cloudinary delete successful');
  } catch (cloudErr) {
    console.error('Cloudinary delete error:', cloudErr);
  }
}
        message.isDeletedGlobally = true;
        message.text = null;
        message.mediaUrl = null;
        message.mediaType = null; 

        
        await message.save();

        
        req.io.to(chat._id.toString()).emit('message-deleted', {
            messageId: message._id,
            chatId: chat._id,
            deleteType: 'everyone'
        });

        return res.status(200).json({ message: "Message deleted for everyone." });
      } else {
        return res.status(400).json({ message: "Cannot delete for everyone as the message has already been seen." });
      }

   
    } else if (deleteType === 'me') {
       
        
        if (!message.deletedFor.includes(senderId)) {
            message.deletedFor.push(senderId);
            await message.save();
        }

       

        return res.status(200).json({ message: "Message deleted for you." });
    
    } else {
        return res.status(400).json({ message: "Invalid delete type specified." });
    }

  } catch (error) {
    console.error("Error deleting message:", error);
    return res.status(500).json({ message: "Server error while deleting message." });
  }
};