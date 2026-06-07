import { state } from "../state.js";
import { supabase } from "../supabase.js";
import {
  createPeerConnection, addTracks, createOffer, createAnswer,
  setLocalDescription, setRemoteDescription, receiveRemoteStream, closePeerConnection
} from "./webrtc.js";
import { sendSignal, listenForSignals } from "./signaling.js";

const $ = (id) => document.getElementById(id);
let callTimerInterval = null;

export async function startVoiceCall() { return startCall(false); }
export async function startVideoCall() { return startCall(true); }

async function startCall(withVideo) {
  if (!state.partnerId || !state.activeRoom) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: withVideo
    });
    state.localStream = stream;
    $("localVideo").srcObject = stream;
    $("callOverlay").classList.add("active");

    const { data: call } = await supabase.from("calls").insert({
      room_id: state.activeRoom,
      caller_id: state.currentUser.id,
      receiver_id: state.partnerId,
      status: "pending",
      media_type: withVideo ? "video" : "audio"
    }).select().single();
    state.activeCallId = call.id;

    const pc = createPeerConnection();
    state.peerConnection = pc;
    addTracks(stream, pc);
    receiveRemoteStream(pc, $("remoteVideo"));

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal(call.id, state.currentUser.id, "candidate", event.candidate);
      }
    };

    const offer = await createOffer(pc);
    await sendSignal(call.id, state.currentUser.id, "offer", offer);

    listenForSignals(call.id, async (signal) => {
      if (signal.sender_id === state.currentUser.id) return;
      if (signal.signal_type === "answer") {
        await setRemoteDescription(pc, signal.payload);
        startTimer();
      } else if (signal.signal_type === "candidate") {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(signal.payload));
        } catch (e) { console.warn("ICE candidate error", e); }
      }
    });

    $("endCallBtn").onclick = () => endCall();
  } catch (err) {
    console.error("Call failed:", err);
    alert("Could not start call: " + err.message);
    endCall();
  }
}

export async function acceptCall(callId) {
  if (!state.currentUser || !callId) return;
  try {
    const { data: call, error: callErr } = await supabase.from("calls").select("*").eq("id", callId).single();
    if (callErr || !call) throw new Error("Call not found");

    const withVideo = call.media_type === "video";
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: withVideo
    });
    state.localStream = stream;
    $("localVideo").srcObject = stream;
    $("callOverlay").classList.add("active");

    const pc = createPeerConnection();
    state.peerConnection = pc;
    addTracks(stream, pc);
    receiveRemoteStream(pc, $("remoteVideo"));

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal(callId, state.currentUser.id, "candidate", event.candidate);
      }
    };

    // Fetch the offer
    const { data: signals } = await supabase.from("call_signals")
      .select("*").eq("call_id", callId).eq("signal_type", "offer")
      .order("created_at", { ascending: false }).limit(1);
    if (signals && signals.length > 0) {
      const offer = signals[0].payload;
      await setRemoteDescription(pc, offer);
      const answer = await createAnswer(pc);
      await sendSignal(callId, state.currentUser.id, "answer", answer);
    }

    await supabase.from("calls").update({ status: "active" }).eq("id", callId);
    state.activeCallId = callId;
    startTimer();

    listenForSignals(callId, async (signal) => {
      if (signal.sender_id === state.currentUser.id) return;
      if (signal.signal_type === "candidate") {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(signal.payload));
        } catch (e) { console.warn("ICE candidate error", e); }
      }
    });

    $("endCallBtn").onclick = () => endCall();
  } catch (err) {
    console.error("Accept call failed:", err);
    alert("Could not accept call: " + err.message);
    rejectCall(callId);
  }
}

export function rejectCall(callId) {
  supabase.from("calls").update({ status: "rejected" }).eq("id", callId);
  $("incomingCallPopup").classList.add("hidden");
}

export function endCall() {
  const pc = state.peerConnection;
  if (pc) closePeerConnection(pc);
  if (state.localStream) {
    state.localStream.getTracks().forEach(track => track.stop());
    state.localStream = null;
  }
  $("remoteVideo").srcObject = null;
  $("localVideo").srcObject = null;
  $("callOverlay").classList.remove("active");
  if (state.activeCallId) {
    supabase.from("calls").update({ status: "ended" }).eq("id", state.activeCallId);
    state.activeCallId = null;
  }
  state.peerConnection = null;
  stopTimer();
}

export function toggleMute() {
  if (state.localStream) {
    const audioTrack = state.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      const icon = $("muteBtn")?.querySelector(".material-symbols-outlined");
      if (icon) icon.textContent = audioTrack.enabled ? "mic" : "mic_off";
    }
  }
}

export function toggleCamera() {
  if (state.localStream) {
    const videoTrack = state.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      const icon = $("cameraBtn")?.querySelector(".material-symbols-outlined");
      if (icon) icon.textContent = videoTrack.enabled ? "videocam" : "videocam_off";
    }
  }
}

function startTimer() {
  const startTime = Date.now();
  callTimerInterval = setInterval(() => {
    const diff = Date.now() - startTime;
    const secs = Math.floor(diff / 1000);
    const mins = Math.floor(secs / 60);
    const seconds = secs % 60;
    const display = `${String(mins).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    const timerEl = $("callTimer");
    if (timerEl) timerEl.textContent = display;
  }, 1000);
}

function stopTimer() {
  clearInterval(callTimerInterval);
  callTimerInterval = null;
  const timerEl = $("callTimer");
  if (timerEl) timerEl.textContent = "00:00";
}