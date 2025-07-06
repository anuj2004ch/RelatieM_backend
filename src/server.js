import express from "express";
import http from "http";
import { Server } from "socket.io";
import cookieParser from "cookie-parser";
import cors from "cors";
import "dotenv/config";

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
    origin: process.env.CLIENT_URL ,
    credentials: true
  }
});
app.use((req, res, next) => {
    req.io = io;
    next();
});


app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/upload", uploadRoutes); 





socketHandler(io);


server.listen(PORT, () => {

  connectDB();
});
