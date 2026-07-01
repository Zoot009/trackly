// Runs in a hidden Electron window. Captures the screen and streams it to the
// viewer over WebRTC. Signaling (offer/answer/ICE) is relayed via IPC ↔ main.
const { ipcRenderer } = require("electron");

let pc = null;

ipcRenderer.on("live:init", async (_e, { iceServers }) => {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 12 },
      audio: false,
    });
    pc = new RTCPeerConnection({ iceServers });
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

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
    if (pc) pc.close();
  } catch {
    /* ignore */
  }
  pc = null;
});
