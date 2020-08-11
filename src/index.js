const express = require("express");
const http = require("http");
const app = new express();
const server = http.createServer(app);
const io = require("socket.io")(server);
const path = require("path");
require("dotenv").config();

const { pairedUser, lostIds: disconnectedIds } = require("./db");

const PORT = process.env.PORT || 3000;
const priorityQueue = [];
let userCount = 0;
let pairCount = 0;
const sockets = {};
var timer;

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
	console.log(`socket.otherUserId 1 :  ${socket.otherUserId}`);
    priorityQueue.push(socket.id);
    socket.emit("loginSuccess");
    findPairForUser();
  });
  //user leaves or closes the browser tab or internet disconnect
  socket.on("disconnect", function () {
    if ("isPaired" in socket) {
      if (socket.isPaired) {
        const otherUserSocket = sockets[socket.otherUserId];
		console.log(`sockets[socket.otherUserId] 2 : ${otherUserSocket}`);
        pairedUser.del(socket.pairCount);
        otherUserSocket.emit("notification", "Reconnecting ...", "info");
        timer = setTimeout(() => {
          // wait for 5000 ms for partner to join
		  if (otherUserSocket.otherUserId===socket.id){
          otherUserSocket.emit("notification", "Your Partner left.", "danger");
          cleanupPair(otherUserSocket);}
          delete sockets[socket.id];
        }, 30000);
      } else {
        delete sockets[socket.id];
		priorityQueue.splice(0, 1);
      }
    }
    userCount--;
    socket.broadcast.emit("system", userCount);
  });
  //new message get
  socket.on("postMsg", function (msg) {
    const otherUserSocket = sockets[socket.otherUserId];
	console.log(`sockets[socket.otherUserId] 3 : ${otherUserSocket}`);
	if (typeof otherUserSocket !== "undefined"){
    otherUserSocket.emit("newMsg", socket.nickname, msg);}
  });
  socket.on("previous id", ({ id: Id, nickname }) => {
    // delete previous socket
    if (Id in sockets) {
      // clear timer
      clearTimeout(timer);
      // id persists and response time < 5000ms
      const otherSocketId = sockets[Id].otherUserId;
	  	console.log(`sockets[id].otherUserId 4.1 : ${otherSocketId}`);
			console.log(`sockets[otherSocketId] 4.2 : ${sockets[otherSocketId]}`);
      if (sockets[otherSocketId].isPaired) {
        socket.nickname = nickname;
        // cleanup previous socket
        delete sockets[Id];
        // register new socket
        sockets[socket.id] = socket;
        cleanupPair(socket);
        cleanupPair(sockets[otherSocketId]);
        pairing(socket.id, otherSocketId, false);
			console.log(`sockets[socket.otherUserId] 4.3 : ${sockets[socket.otherUserId]}`);
        sockets[socket.otherUserId].emit("remove notification");
      }
    } else {
      if (typeof Id !== "undefined") {
        sockets[socket.id] = socket;
        socket.nickname = nickname;
        cleanupPair(socket);
        socket.emit("notification", "You are disconnected", "danger");
      }
    }
  });
  socket.on("findAnotherPair", () => {
    if (socket.isPaired) {
      pairedUser.del(socket.pairCount);
	  console.log(`sockets[socket.otherUserId] 5 : ${sockets[socket.otherUserId]}`);
      cleanupPair(sockets[socket.otherUserId]);
      sockets[socket.otherUserId].emit("notification", "Your Partner left.", "danger");
      cleanupPair(socket);
    }
    priorityQueue.push(socket.id);
    findPairForUser();
  });

  socket.on("getMeOut", () => {
    if (socket.isPaired) {
      pairedUser.del(socket.pairCount);
	  console.log(`sockets[socket.otherUserId] 6 : ${sockets[socket.otherUserId]}`);
      cleanupPair(sockets[socket.otherUserId]);
      sockets[socket.otherUserId].emit("notification", "Your Partner left.", "danger");
      cleanupPair(socket);
    }
    //socket.emit("partnerLeft", "You have successfully left the room.");
  });

  socket.on("timer expired", () => {
    if (socket.isPaired) {
      pairedUser.del(socket.pairCount);
	  console.log(`sockets[socket.otherUserId] 7 : ${sockets[socket.otherUserId]}`);
      cleanupPair(sockets[socket.otherUserId]);
      sockets[socket.otherUserId].emit("notification", "Your time has ended.", "danger");
      cleanupPair(socket);
      socket.emit("notification", "Your time has ended.", "danger");
    }
  });

  function findPairForUser() {
    while (priorityQueue.length > 1) {
      pairing(priorityQueue[0], priorityQueue[1]);
    }
  }

  function pairing(s1, s2, bool) {
    if (pairedUser.set(pairCount, [s1, s2], 0)) {
      const userSocket = sockets[s1];
      const otherUserSocket = sockets[s2];
	  console.log(` userSocket 8.1 : ${sockets[s1]}`);
	  console.log(` otherUserSocket 8.2 : ${sockets[s2]}`);
      pairCount++;
      prepareForPairing(userSocket, otherUserSocket, bool);
      prepareForPairing(otherUserSocket, userSocket, bool);
      priorityQueue.splice(0, 2);
    }
  }

  function prepareForPairing(e, f, bool = true) {
	  console.log(`e 9.1 : ${e}`);
	  console.log(`f 9.2 : ${f}`);
    e.isPaired = true;
    e.pairCount = pairCount;
    e.otherUserId = f.id;
    bool && e.emit("gotAPair", e.nickname, f.nickname);
  }

  function cleanupPair(e) {
	  console.log(`e 10 : ${e}`);
    e.isPaired = false;
    e.pairCount = "";
    e.otherUserId = "";
  }
});
