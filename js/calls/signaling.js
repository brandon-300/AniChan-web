import { supabase } from "../supabase.js";
import { state } from "../state.js";

export async function sendSignal(callId, senderId, type, payload) {
  await supabase.from("call_signals").insert({
    call_id: callId,
    sender_id: senderId,
    signal_type: type,
    payload
  });
}

export function listenForSignals(callId, onSignal) {
  supabase.channel(`signals-${callId}`)
    .on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "call_signals",
      filter: `call_id=eq.${callId}`
    }, (payload) => {
      onSignal(payload.new);
    })
    .subscribe();
}

export function listenForIncomingCalls() {
  supabase.channel("incoming-calls")
    .on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "calls",
      filter: `receiver_id=eq.${state.currentUser?.id}`
    }, (payload) => {
      const call = payload.new;
      if (call.status === "pending") {
        // Show incoming popup
        const callerName = state.rooms.find(r => r.other_user.id === call.caller_id)?.other_user?.full_name || "Unknown";
        const type = "call"; // you could detect if video
        showIncomingPopup(call.id, callerName, type);
      }
    })
    .subscribe();
}

function showIncomingPopup(callId, callerName, type) {
  const popup = document.getElementById("incomingCallPopup");
  const callerEl = document.getElementById("incomingCaller");
  const typeEl = document.getElementById("incomingCallType");
  if (popup && callerEl && typeEl) {
    callerEl.textContent = callerName;
    typeEl.textContent = type;
    popup.classList.remove("hidden");
    document.getElementById("acceptCallBtn").onclick = () => {
      popup.classList.add("hidden");
      import("./calls.js").then(m => m.acceptCall(callId));
    };
    document.getElementById("declineCallBtn").onclick = () => {
      popup.classList.add("hidden");
      import("./calls.js").then(m => m.rejectCall(callId));
    };
  }
}