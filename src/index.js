const express = require("express");
const http = require("http");
const app = new express();
const server = http.createServer(app);
const io = require("socket.io")(server);
const path = require("path");

const { pairedUser } = require("./db");

const PORT = process.env.PORT || 3000;
const priorityQuque = [];
let userCount = 0;
let pairCount = 0;
const sockets = {};

app.use(express.static(path.resolve(__dirname, "../build")));

server.listen(PORT, () => {
  console.log(`Server is Running on PORT ${PORT}`);
});

io.sockets.on("connection", function (socket) {
  //new user login
  userCount++;
  io.sockets.emit("system", userCount);
  socket.on("login", function (nickname) {
    //socket.userIndex = users.length;
    sockets[socket.id] = socket;
    socket.nickname = nickname;
    socket.isPaired = false;
    socket.pairCount = "";
    socket.otherUserId = "";
    priorityQuque.push(socket.id);
    socket.emit("loginSuccess");
    findPairForUser();
  });
  //user leaves
  socket.on("disconnect", function () {
    if ("id" in socket) {
      if (socket.isPaired) {
        pairedUser.del(socket.pairCount);
        const otherUserSocket = sockets[socket.otherUserId];
        otherUserSocket.emit("notification", "Your Partner left.", "danger");
        delete sockets[socket.id];
        cleanupPair(otherUserSocket);
      } else {
        delete sockets[socket.id];
      }
    }
    userCount--;
    socket.broadcast.emit("system", userCount);
  });
  //new message get
  socket.on("postMsg", function (msg) {
    const otherUserSocket = sockets[socket.otherUserId];
    otherUserSocket.emit("newMsg", socket.nickname, msg);
  });

  socket.on("findAnotherPair", () => {
    if (socket.isPaired) {
      pairedUser.del(socket.pairCount);
      cleanupPair(sockets[socket.otherUserId]);
      sockets[socket.otherUserId].emit("notification", "Your Partner left.", "danger");
      cleanupPair(socket);
    }
    priorityQuque.push(socket.id);
    findPairForUser();
  });

  socket.on("getMeOut", () => {
    if(socket.isPaired){
      pairedUser.del(socket.pairCount);
      cleanupPair(sockets[socket.otherUserId]);
      sockets[socket.otherUserId].emit("notification", "Your Partner left.", "danger");
      cleanupPair(socket);
    }
    //socket.emit("partnerLeft", "You have successfully left the room.");
  });

  function findPairForUser() {
    while (priorityQuque.length > 1) {
      if (pairedUser.set(pairCount, [priorityQuque[0], priorityQuque[1]], 0)) {
        const userSocket = sockets[priorityQuque[0]];
        const otherUserSocket = sockets[priorityQuque[1]];
        pairCount++;
        prepareForPairing(userSocket, otherUserSocket);
        prepareForPairing(otherUserSocket, userSocket);
        priorityQuque.splice(0, 2);
      }
    }
  }

  function prepareForPairing(e, f) {
    e.isPaired = true;
    e.pairCount = pairCount;
    e.otherUserId = f.id;
    e.emit("gotAPair", e.nickname, f.nickname);
  }

  function cleanupPair(e) {
    e.isPaired = false;
    e.pairCount = "";
    e.otherUserId = "";
  }
});
