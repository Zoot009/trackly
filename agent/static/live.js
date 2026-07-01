// Runs in a hidden Electron window. Captures the screen, routes it through a
// canvas (so private apps can be blacked out), and streams the canvas to the
// viewer over WebRTC. Signaling (offer/answer/ICE) is relayed via IPC ↔ main.
const { ipcRenderer } = require("electron");

let pc = null;
let isPrivate = false;
let drawTimer = null;

ipcRenderer.on("live:init", async (_e, { iceServers }) => {
  try {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 12 },
      audio: false,
    });

    const video = document.createElement("video");
    video.srcObject = screenStream;
    video.muted = true;
    await video.play();

    const settings = screenStream.getVideoTracks()[0].getSettings();
    const canvas = document.createElement("canvas");
    canvas.width = settings.width || 1280;
    canvas.height = settings.height || 720;
    const ctx = canvas.getContext("2d");

    const render = () => {
      if (isPrivate) {
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#9ca3af";
        ctx.font = "28px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Private app — screen hidden", canvas.width / 2, canvas.height / 2);
      } else {
        try {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        } catch {
          /* frame not ready */
        }
      }
    };
    drawTimer = setInterval(render, 1000 / 12);

    const outStream = canvas.captureStream(12);
    pc = new RTCPeerConnection({ iceServers });
    outStream.getTracks().forEach((track) => pc.addTrack(track, outStream));

    pc.onicecandidate = (e) => {
      if (e.candidate) ipcRenderer.send("live:ice", e.candidate.toJSON());
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    ipcRenderer.send("live:offer", { type: offer.type, sdp: offer.sdp });
  } catch (err) {
    ipcRenderer.send("live:error", String(err && err.message ? err.message : err));
  }
});

ipcRenderer.on("live:privacy", (_e, priv) => {
  isPrivate = !!priv;
});

ipcRenderer.on("live:answer", async (_e, sdp) => {
  try {
    if (pc) await pc.setRemoteDescription(sdp);
  } catch (err) {
    ipcRenderer.send("live:error", "answer: " + String(err));
  }
});

ipcRenderer.on("live:ice", async (_e, candidate) => {
  try {
    if (pc && candidate) await pc.addIceCandidate(candidate);
  } catch (err) {
    ipcRenderer.send("live:error", "ice: " + String(err));
  }
});

ipcRenderer.on("live:stop", () => {
  try {
    if (drawTimer) clearInterval(drawTimer);
    if (pc) pc.close();
  } catch {
    /* ignore */
  }
  drawTimer = null;
  pc = null;
});
