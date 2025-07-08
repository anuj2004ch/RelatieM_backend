import express from "express";
import http from "http";
import { Server } from "socket.io";
import cookieParser from "cookie-parser";
import cors from "cors";
import "dotenv/config";

import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis"; // ✅ use default import, not { createClient }

import { connectDB } from "./lib/db.js";
import socketHandler from "./lib/socket.js";

// Routes
import authRoutes from "./routes/auth.route.js";
import userRoutes from "./routes/user.route.js";
import chatRoutes from "./routes/chat.route.js";
import uploadRoutes from "./routes/upload.routes.js";

const app = express();
const PORT = process.env.PORT || 5001;
const server = http.createServer(app);

// ✅ Socket.io setup
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL,
    credentials: true,
  },
});

// 🔌 Attach io to requests if needed
app.use((req, res, next) => {
  req.io = io;
  next();
});

// ✅ Middlewares
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// ✅ Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/upload", uploadRoutes);

const startServer = async () => {
  try {
    // 🔌 Upstash Redis setup (no need to manually connect)
    const pubClient = new Redis(process.env.REDIS_URL, {
      tls: {}, // required by Upstash
    });
    const subClient = pubClient.duplicate();

    io.adapter(createAdapter(pubClient, subClient)); // apply Redis adapter

   
    socketHandler(io);

    server.listen(PORT, "0.0.0.0", () => {
  connectDB();
  console.log(`🚀 Server running on port ${PORT}`);
});

  } catch (error) {
    console.error("❌ Redis adapter connection failed:", error);
    process.exit(1);
  }
};


startServer();
