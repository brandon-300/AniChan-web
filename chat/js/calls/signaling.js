import { supabase } from "../supabase.js";
import { state } from "../state.js";

export async function sendSignal(callId, senderId, type, payload) {
  await supabase.from("call_signals").insert({ call_id: callId, sender_id: senderId, signal_type: type, payload });
}

export function listenForSignals(callId, onSignal) {
  supabase.channel(`signals-${callId}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "call_signals", filter: `call_id=eq.${callId}` }, (payload) => onSignal(payload.new))
    .subscribe();
}

export function listenForIncomingCalls() {
  if (!state.currentUser) return;
  supabase.channel("incoming-calls")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "calls", filter: `receiver_id=eq.${state.currentUser.id}` }, (payload) => {
      const call = payload.new;
      if (call.status === "pending") showIncomingPopup(call);
    })
    .subscribe();
}

function showIncomingPopup(call) {
  const popup = document.getElementById("incomingCallPopup");
  if (!popup) return;
  const caller = state.rooms.find(r => r.other_user.id === call.caller_id)?.other_user?.full_name || "User";
  document.getElementById("incomingCaller").textContent = caller;
  document.getElementById("incomingCallType").textContent = call.media_type === "video" ? "video call" : "voice call";
  popup.classList.remove("hidden");
  document.getElementById("acceptCallBtn").onclick = () => { popup.classList.add("hidden"); import("./calls.js").then(m => m.acceptCall(call.id)); };
  document.getElementById("declineCallBtn").onclick = () => { popup.classList.add("hidden"); import("./calls.js").then(m => m.rejectCall(call.id)); };
}