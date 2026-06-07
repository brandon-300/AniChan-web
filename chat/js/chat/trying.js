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
      if (room) setPartnerStatus(room.other_user.is_online, room.other_user.last_seen);
    }
  }
  if (isTyping) state.typingUsers.set(userId, true);
  else state.typingUsers.delete(userId);
  filterRooms($("searchInput").value);
}

function setPartnerStatus(isOnline, lastSeen) {
  const sub = $("partnerSub");
  if (sub.classList.contains("typing-status")) return;
  if (isOnline) {
    $("partnerDot").classList.add("live");
    sub.textContent = "online";
  } else {
    $("partnerDot").classList.remove("live");
    sub.textContent = lastSeen ? `last seen ${fmtChat(lastSeen)}` : "Offline";
  }
}

function fmtChat(iso) {
  if (!iso) return '';
  const d = new Date(iso), n = new Date(), diff = n - d, mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d ago`;
  return d.toLocaleDateString();
}