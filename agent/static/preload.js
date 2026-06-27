const { contextBridge, ipcRenderer } = require("electron");

// Minimal, safe bridge for the enrollment window only.
contextBridge.exposeInMainWorld("flowace", {
  enroll: (token) => ipcRenderer.invoke("flowace:enroll", token),
  getServerUrl: () => ipcRenderer.invoke("flowace:server-url"),
});
