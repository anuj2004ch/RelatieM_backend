import express from "express";
import http from "http";
import { Server } from "socket.io";
import cookieParser from "cookie-parser";
import cors from "cors";
import "dotenv/config";

import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "ioredis";

import { connectDB } from "./lib/db.js";
import socketHandler from "./lib/socket.js";

// Routes
import authRoutes from "./routes/auth.route.js";
import userRoutes from "./routes/user.route.js";
import chatRoutes from "./routes/chat.route.js";
import uploadRoutes from "./routes/upload.routes.js";

const app = express();
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL,
    credentials: true
  }
});

// Attach io to each request (optional, only if you use req.io in routes)
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/upload", uploadRoutes);

// 🔌 Redis Adapter Setup
const startServer = async () => {
  try {
    const pubClient = new createClient(process.env.REDIS_URL, {
      tls: {} // required for Upstash
    });
    const subClient = pubClient.duplicate();

    await pubClient.connect();
    await subClient.connect();

    io.adapter(createAdapter(pubClient, subClient));

    // Initialize WebSocket events
    socketHandler(io);

    // Start server
    server.listen(PORT, () => {
      connectDB();
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Redis adapter connection failed:", error);
    process.exit(1);
  }
};

startServer();
