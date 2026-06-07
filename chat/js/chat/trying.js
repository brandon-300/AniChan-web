import { supabase } from "../supabase.js";
import { state } from "../state.js";
import { filterRooms } from "./rooms.js";
const $ = (id) => document.getElementById(id);

export function setupBroadcastChannel(roomId) {
  if (state.broadcastChannel) supabase.removeChannel(state.broadcastChannel);
  state.broadcastChannel = supabase.channel(`typing:${roomId}`, { config: { broadcast: { self: false } } })
    .on("broadcast", { event: "typing" }, ({ payload }) => {
      if (!payload || payload.user_id === state.currentUser.id) return;
      handleTypingBroadcast(payload.user_id, payload.is_typing);
    })
    .subscribe();
}

export function broadcastTyping(isTyping) {
  if (!state.broadcastChannel || !state.currentUser) return;
  state.broadcastChannel.send({
    type: "broadcast",
    event: "typing",
    payload: { user_id: state.currentUser.id, is_typing: isTyping }
  });
}

export function handleTypingBroadcast(userId, isTyping) {
  if (userId === state.partnerId) {
    const sub = $("partnerSub");
    const indicator = $("typingIndicator");
    if (isTyping) {
      sub.textContent = "typing...";
      sub.classList.add("typing-status");
      const partnerName = $("partnerName")?.textContent || "Someone";
      indicator.innerHTML = `${partnerName} is typing <div class="typing-dots"><span></span><span></span><span></span></div>`;
    } else {
      sub.classList.remove("typing-status");
      indicator.innerHTML = "";
      const room = state.rooms.find(r => r.other_user.id === userId);
      if (room) {
        // Restore status via presence.js (already handles)
      }
    }
  }
  if (isTyping) state.typingUsers.set(userId, true);
  else state.typingUsers.delete(userId);
  filterRooms($("searchInput").value);
}

$("msgInput")?.addEventListener("input", () => {
  if (!state.broadcastChannel || !state.activeRoom) return;
  broadcastTyping(true);
  clearTimeout(state.typingTimeout);
  state.typingTimeout = setTimeout(() => broadcastTyping(false), 2000);
});