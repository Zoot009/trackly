"use client";

import { useEffect, useRef, useState } from "react";
import { getSocket } from "@/lib/socket";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * Live screen viewer over WebRTC. Opens a signaling session with the agent
 * (which is the sender/offerer); we answer and render the incoming stream.
 */
export function LiveView({
  employeeId,
  employeeName,
  open,
  onOpenChange,
}: {
  employeeId: string;
  employeeName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const sessionRef = useRef<string | null>(null);
  const [status, setStatus] = useState("Connecting…");

  useEffect(() => {
    if (!open) return;
    const socket = getSocket();
    let iceServers: RTCIceServer[] = [];
    setStatus("Requesting screen…");

    const onConfig = (msg: { sessionId: string; iceServers: RTCIceServer[] }) => {
      sessionRef.current = msg.sessionId;
      iceServers = msg.iceServers ?? [];
    };

    const onOffer = async (msg: { sessionId: string; sdp: RTCSessionDescriptionInit }) => {
      sessionRef.current = msg.sessionId;
      const pc = new RTCPeerConnection({ iceServers });
      pcRef.current = pc;
      pc.ontrack = (e) => {
        if (videoRef.current) videoRef.current.srcObject = e.streams[0] ?? null;
        setStatus("Live");
      };
      pc.onicecandidate = (e) => {
        if (e.candidate) socket.emit("live:ice", { sessionId: msg.sessionId, candidate: e.candidate.toJSON() });
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") setStatus("Live");
        else if (pc.connectionState === "failed") setStatus("Connection failed (network/firewall)");
        else if (pc.connectionState === "disconnected") setStatus("Disconnected");
      };
      try {
        await pc.setRemoteDescription(msg.sdp);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("live:answer", { sessionId: msg.sessionId, sdp: { type: answer.type, sdp: answer.sdp } });
        setStatus("Negotiating…");
      } catch {
        setStatus("Failed to start");
      }
    };

    const onIce = async (msg: { candidate: RTCIceCandidateInit }) => {
      try {
        if (msg.candidate) await pcRef.current?.addIceCandidate(msg.candidate);
      } catch {
        /* ignore */
      }
    };

    socket.on("live:config", onConfig);
    socket.on("live:offer", onOffer);
    socket.on("live:ice", onIce);
    socket.emit("live:start", { employeeId });

    return () => {
      if (sessionRef.current) socket.emit("live:stop", { sessionId: sessionRef.current });
      socket.off("live:config", onConfig);
      socket.off("live:offer", onOffer);
      socket.off("live:ice", onIce);
      pcRef.current?.close();
      pcRef.current = null;
      sessionRef.current = null;
    };
  }, [open, employeeId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            Live · {employeeName} <span className="text-sm font-normal text-muted-foreground">— {status}</span>
          </DialogTitle>
        </DialogHeader>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="aspect-video w-full rounded-md bg-black"
        />
        <p className="text-xs text-muted-foreground">
          Live view streams the employee&apos;s screen in real time while this window is open.
        </p>
      </DialogContent>
    </Dialog>
  );
}
