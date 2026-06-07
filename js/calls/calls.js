import { state } from "../state.js";
import { supabase } from "../supabase.js";
import {
  createPeerConnection,
  addTracks,
  createOffer,
  createAnswer,
  setLocalDescription,
  setRemoteDescription,
  receiveRemoteStream,
  handleICECandidate,
  closePeerConnection
} from "./webrtc.js";
import { sendSignal, listenForSignals } from "./signaling.js";

const $ = (id) => document.getElementById(id);

export async function startVoiceCall() { return startCall(false); }
export async function startVideoCall() { return startCall(true); }

async function startCall(withVideo) {
  if (!state.partnerId || !state.activeRoom) return;
  try {
    // Get user media
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: withVideo
    });
    state.localStream = stream;

    // Show local preview
    $("localVideo").srcObject = stream;
    $("callOverlay").classList.add("active");

    // Create a call row in DB
    const { data: call } = await supabase.from("calls").insert({
      room_id: state.activeRoom,
      caller_id: state.currentUser.id,
      receiver_id: state.partnerId,
      status: "pending"
    }).select().single();
    state.activeCallId = call.id;

    // Create peer connection
    const pc = createPeerConnection();
    state.peerConnection = pc;

    // Add tracks
    addTracks(stream, pc);

    // Receive remote video when available
    receiveRemoteStream(pc, $("remoteVideo"));

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        handleICECandidate(pc, state.currentUser.id, state.activeCallId, "candidate", event.candidate);
      }
    };

    // Create and send offer
    const offer = await createOffer(pc);
    await sendSignal(state.activeCallId, state.currentUser.id, "offer", offer);

    // Listen for answer (signalling)
    listenForSignals(state.activeCallId, async (signal) => {
      if (signal.sender_id === state.currentUser.id) return; // ignore own signals
      if (signal.signal_type === "answer") {
        await setRemoteDescription(pc, signal.payload);
      } else if (signal.signal_type === "candidate") {
        await pc.addIceCandidate(new RTCIceCandidate(signal.payload));
      }
    });

    // End call button
    $("endCallBtn").onclick = () => endCall();

  } catch (err) {
    console.error("Call failed:", err);
    alert("Could not start call: " + err.message);
  }
}

export function acceptCall(callId) {
  // Will be called from incoming popup
  // Implementation: get local media, create answer, etc.
  // For now just alert
  alert("Accept call not yet fully implemented.");
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
}