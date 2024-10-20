const express = require("express");
const cors = require("cors");
const socketIo = require("socket.io");
const http = require("node:http");

// Initial users database
let usersDB = [
    { id: 1, login: "test1", password: "test" },
    { id: 2, login: "test2", password: "test" }
];

const app = express();
const serverHttp = http.createServer(app);
const io = socketIo(serverHttp, {
    cors: {
        origin: "*",
    }
});

app.use(express.json());
app.use(cors());

app.get("/ok", (req, res) => {
    res.json({ message: "ok" });
});

app.post("/register", (req, res) => {
    const { login, password } = req.body;

    const userExists = usersDB.some(user => user.login === login);
    if (userExists) {
        return res.status(400).json({ message: "User already exists" });
    }

    const newUser = {
        id: usersDB.length + 1, 
        login: login,
        password: password
    };

    usersDB.push(newUser);
    res.status(201).json({ message: "User created successfully", user: newUser });
});

const onlineUsers = new Map();

io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    
    socket.on("login", ({ login, password }) => {
        const loginedUser = usersDB.find(user => user.login === login && user.password === password);
        if (loginedUser) {
            onlineUsers.set(socket.id, loginedUser);
            console.log(`User ${loginedUser.login} logged in with socket ID ${socket.id}`);

            const onlineUsersData = Array.from(onlineUsers.values());
            io.emit("online-users", { onlineUsers: onlineUsersData });
        } else {
            socket.emit("login-error", { message: "Invalid login or password" });
        }
    });

    socket.on("send-message", (data) => {
        const targetSocketId = [...onlineUsers.entries()]
            .find(([id, user]) => user.id === Number(data.userID))?.[0]; 

        if (targetSocketId) {
            io.to(targetSocketId).emit("new-message", { from: onlineUsers.get(socket.id).login, message: data.message }); 
        } else {
            socket.emit("message-error", { message: "User not online" });
        }
    });


    socket.on("disconnect", () => {
        onlineUsers.delete(socket.id);
        const onlineUsersData = Array.from(onlineUsers.values());
        io.emit("online-users", { onlineUsers: onlineUsersData });
        console.log("User disconnected:", socket.id);
    });
});


serverHttp.listen(3000, () => {
    console.log("Server running at http://localhost:3000");
});
