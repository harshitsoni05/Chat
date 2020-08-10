const { startup, stopStreaming } = require("./capture");
const timer = require("./timer");

class Chat {
  constructor() {
    this.socket = io.connect();
    this.init();
  }
  init() {
    const mainPage = document.getElementById("mainPage");
    const landingPage = document.getElementById("landingPage");
    const overlayBtn = document.getElementById("overlayBtn");
    const info = document.getElementById("info");
    const notification = document.getElementById("notification");
    const messageInput = document.getElementById("inputText");
    const nextBtn = document.getElementById("next");
    const exitBtn = document.getElementById("exit");
    const navbar = document.getElementById("simpleNavbar");
    const modal = document.getElementById("modal");
    const modal1 = document.getElementById("modal1");
    const tc = document.getElementById("tc");
    const ctn = document.getElementById("ctn");
    const cameraBtn = document.getElementById("cameraBtn");
    const modalBis = document.getElementById("modal-bis");
    const modalBisCloseBtn = document.getElementById("modal-bis-close-btn");
    const displayedPic = document.getElementById("photo");
    const keyboard = document.getElementById("keyboard");
    const timerHTML = document.getElementById("timer");

    tc.addEventListener("click", () => {
      document.getElementById("modal1").classList.add("is-active");
    });

    ctn.addEventListener("click", () => {
      document.getElementById("modal1").classList.remove("is-active");
    });

    let countdown;
    let that = this;
    let firstTime = true;
    this.socket.on("connect", () => {
      console.log("connect", this.socket.id);
      document.getElementById("name").focus();
      // navbar.style.display = "none";
      if (!firstTime) {
        if (this.socket.connected) {
          this.socket.emit("previous id", {
            id: localStorage.getItem("socketId"),
            nickname: localStorage.getItem("nickname"),
          });
        }
      } else {
        localStorage.removeItem("socketId");
        localStorage.removeItem('nickname')
      }
    });

    this.socket.on("reconnect", () => {
      notification.style.display = "none";
      notification.classList.remove("is-danger");
      const div = document.querySelector("#notification div");
      div.textContent = "";
    });

    this.socket.on("reconnecting", () => {
      displayNotification("Reconnecting...", "info");
      console.log("Reconnecting... to server");
    });

    this.socket.on("disconnect", (reason) => {
      if (reason === "io server disconnect") {
        // the disconnection was initiated by the server, you need to reconnect manually
        this.socket.connect();
      } else {
        // else the socket will automatically try to reconnect
      }
      console.log("socket disconnected");
    });

    this.socket.once("connect_error", function () {
      // pause your timer
      console.log("connect error");
      displayNotification("No internet connection.", "danger");
    });

    this.socket.on("loginSuccess", () => {
      if (info.style.display == "block") {
        info.style.display = "none";
      }
      overlayBtn.classList.add("is-loading");
	  overlayBtn.disabled = true;
      modal.classList.add("is-active");
    });

    this.socket.on("gotAPair", (user, otherUser) => {
      firstTime = false;
      notification.style.display = "none";
      [modal, overlayBtn].forEach((e) => {
        e.classList.remove("is-active");
      });
      mainPage.style.display = "block";
      navbar.style.display = "flex";
      landingPage.style.display = "none";
	  //document.getElementById("msgContainer")="";
      if (keyboard.style.display == "none") {
        keyboard.style.display = "flex";
      }
      document.getElementById("otherUser").textContent = `${otherUser}`;
      messageInput.disabled = false;
      clearInterval(countdown);
      document.getElementById("timer").textContent = "";
      localStorage.setItem("socketId", this.socket.id);
      localStorage.setItem("nickname", user);
      countdown = timer(function () {
        that.socket.emit("timer expired");
      }).ref;
    });
    this.socket.on("remove notification", () => {
      notification.style.display = "none";
    });
    this.socket.on("partnerLeft", (msg) => {
      // clear your timer
      clearTimer();
      displayMessageOnLogin(msg);
    });

    this.socket.on("notification", (msg, code) => {
      displayNotification(msg, code);
      clearTimer();
      if (msg == "Your Partner left." || msg == "Your time has ended." || msg == "You are disconnected") {
        keyboard.style.display = "none";
      }
    });

    this.socket.on("newMsg", function (user, msg) {
      that._displayNewMsg(user, msg, "left");
    });

    nextBtn.addEventListener("click", () => {
      document.getElementById("modal-quar").classList.remove("is-active");
      that.socket.emit("findAnotherPair");
      modal.classList.add("is-active");
      // clear your timer
      clearTimer();
      that._removeChild(document.getElementById("msgContainer"));
    });

    exitBtn.addEventListener("click", () => {
      document.getElementById("modal-tris").classList.remove("is-active");
      // clear your timer
      clearTimer();
      that.socket.emit("getMeOut");
      displayMessageOnLogin("");
    });

    document.getElementById("overlayBtn").addEventListener(
      "click",
      () => {
        var nickName = document.getElementById("name").value;
        if (nickName.trim().length != 0) {
          that.socket.emit("login", nickName);
        } else {
          document.getElementById("name").focus();
        }
      },
      false
    );

    document.getElementById("close_btn").addEventListener("click", () => {
      notification.style.display = "none";
    });
    document.getElementById("name").addEventListener("keyup", loginHandler, false);
    document.getElementById("btnSend").addEventListener("click", sendMessageHander, false);
    messageInput.addEventListener("keyup", sendMessageHander, false);
    messageInput.addEventListener("input", () => {
      that.socket.emit("postMsg", { msg: "", typing: true });
    });
    cameraBtn.addEventListener("click", () => {
      modalBis.classList.add("is-active");
      startup();
    });
    modalBisCloseBtn.addEventListener("click", () => {
      modalBis.classList.remove("is-active");
      displayedPic.setAttribute("src", "");
      stopStreaming();
    });
    document.getElementById("imageBtn").addEventListener(
      "click",
      () => {
        if (displayedPic.src !== "") {
          that.socket.emit("postMsg", { msg: "", img: displayedPic.src, typing: false });
          that._displayNewMsg("me", { msg: "", img: displayedPic.src, typing: false });
          modalBisCloseBtn.click();
        }
      },
      false
    );

    function clearTimer() {
      clearInterval(countdown);
      timerHTML.textContent = "";
    }

    function displayNotification(msg, type) {
      clearNotification();
      type === "danger" && notification.classList.add("is-danger");
      type === "success" && notification.classList.add("is-success");
      type === "info" && notification.classList.add("is-info");
      const div = document.querySelector("#notification div");
      div.textContent = msg;
      notification.style.display = "block";
    }
    function clearNotification() {
      notification.classList.remove(["is-info", "is-danger", "is-success"]);
      const div = document.querySelector("#notification div");
      div.textContent = "";
    }
    function loginHandler(e) {
      if (isNaN(Number(e.keyCode)) || e.keyCode === 13) {
        var nickName = document.getElementById("name").value;
        if (nickName.trim().length != 0) {
          that.socket.emit("login", nickName);
        }
      }
    }

    function sendMessageHander(e) {
      var msg = messageInput.value;
      if (msg.trim().length != 0) {
        if (isNaN(Number(e.keyCode)) || e.keyCode === 13) {
          messageInput.value = "";
          that.socket.emit("postMsg", { msg, typing: false });
          that._displayNewMsg("me", { msg }, "right");
        }
      }
    }
    function displayMessageOnLogin(msg) {
      if (notification.style.display == "block") {
        notification.style.display = "none";
      }
      mainPage.style.display = "none";
      that._removeChild(document.getElementById("msgContainer"));
      landingPage.style.display = "block";
      navbar.style.display = "none";
      overlayBtn.classList.remove("is-loading");
      overlayBtn.textContent = "Start";
      if (info.style.display === "none") {
        const innerHTML = `<span class="span">${msg}</span>`;
        info.innerHTML = innerHTML;
        info.style.display = "block";
      }
    }
  }

  _removeChild(node) {
    [].slice.call(node.children).forEach((e) => {
      node.removeChild(e);
    });
  }

  _displayNewMsg(user, msg, direction) {
    const container = document.getElementById("msgContainer");
    let HTML = document.createElement("div");

    if (direction === "left") {
      ["has-text-left", "is-size-8", "left-aligned"].forEach((e) => HTML.classList.add(e));
      let html;
      const leftMsg = document.querySelectorAll(".left-aligned");
      const leftLastChild = leftMsg[leftMsg.length - 1];
      if (msg.typing) {
        if (leftMsg.length == 0 || leftLastChild.textContent !== `${user}: typing...`) {
          html = `<span class="span"><strong>${user}: </strong></span><span class="span">typing...</span>`;
          HTML.innerHTML = html;
          container.appendChild(HTML);
        }
      } else {
        if ("img" in msg) {
          // it's an image
          const img = new Image();
          img.onload = function () {
            ["has-text-left", "is-size-6", "left-aligned"].forEach((e) => HTML.classList.add(e));
            HTML.innerHTML = `<img src="${img.src}">`;
            container.appendChild(HTML);
          };
          img.src = msg.img;
        } else {
          if (leftMsg.length == 0 || leftLastChild.textContent === `${user}: typing...`) {
            // remove typing child
            container.removeChild(leftLastChild);
            html = `<div class="talk-bubble1 tri-left round left-in" style="max-width: 80%; display: inline-block;"><div class="talktext1" style="overflow-wrap: break-word;"><span class="span">${msg.msg}</span></div></div>`;
          } else {
            html = `<div class="talk-bubble1 tri-left round left-in" style="max-width: 80%; display: inline-block;"><div class="talktext1" style="overflow-wrap: break-word;"><span class="span">${msg.msg}</span></div></div>`;
          }
          HTML.innerHTML = html;
          container.appendChild(HTML);
        }
      }
    } else {
      if ("img" in msg) {
        // it's an image
        const img = new Image();
        img.onload = function () {
          ["has-text-right", "is-size-6", "right-aligned"].forEach((e) => HTML.classList.add(e));
          HTML.innerHTML = `<img src="${img.src}">`;
          container.appendChild(HTML);
        };
        img.src = msg.img;
      } else {
        ["has-text-right", "is-size-8", "right-aligned"].forEach((e) => HTML.classList.add(e));
        HTML.innerHTML = `<div class="talk-bubble tri-right round right-in" style="max-width: 80%; display: inline-block;"><div class="talktext" style="overflow-wrap: break-word;"><span class="span">${msg.msg}</span></div></div>`;
        container.appendChild(HTML);
      }
    }
    scrollToBottom();
  }
}

function scrollToBottom() {
  const messages = document.getElementById("mainPage");
  messages.scrollTop = messages.scrollHeight;
}

scrollToBottom();

window.addEventListener("beforeunload", function (event) {
  event.returnValue = "STOP!!!";
});

module.exports = Chat;
