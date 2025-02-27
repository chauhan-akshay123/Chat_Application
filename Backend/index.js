const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const http = require("http");
const { initializeDatabase } = require("./db/db.connect");
const authRoutes = require("./route/auth");
const { Server } = require("socket.io");
const Messages = require("./models/Messages.model");
const User = require("./models/User.model");

dotenv.config();
initializeDatabase();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:3000", 
    },
});

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.status(200).send("Welcome to Chat Application");
});

app.use("/auth", authRoutes);

// ✅ WebSocket Logic (Fixed sender duplicate issue)
io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("send_message", async (data) => {
        const { sender, receiver, message } = data;
        const newMessage = new Messages({ sender, receiver, message });
        await newMessage.save();

        // ✅ Broadcast message to everyone EXCEPT sender
        socket.broadcast.emit("receive_message", data);
    });

    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
    });
});

// ✅ Fetch chat messages between two users
app.get("/messages", async (req, res) => {
    const { sender, receiver } = req.query;
    try {
        const messages = await Messages.find({
            $or: [
                { sender, receiver },
                { sender: receiver, receiver: sender }
            ],
        }).sort({ createdAt: 1 });

        res.status(200).json(messages);
    } catch (error) {
        res.status(500).json({ message: "Error fetching messages", error: error.message });
    }
});

// ✅ Fetch users except the current logged-in user
app.get("/users", async (req, res) => {
    const { currentUser } = req.query;
    try {
        const users = await User.find({ username: { $ne: currentUser } });
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ message: "Error fetching users", error: error.message });
    }
});

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
    console.log(`Server is running on PORT: ${PORT}`);
});
