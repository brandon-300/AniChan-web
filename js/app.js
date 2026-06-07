import { supabase } from "./supabase.js";
import { state } from "./state.js";
import { initRooms, loadRooms, filterRooms, openRoom, closeRoom, startOrOpenChat } from "./chat/rooms.js";
import { loadMsgs, sendMsg, subMsgs } from "./chat/messages.js";
import { setupBroadcastChannel, broadcastTyping, handleTypingBroadcast } from "./chat/typing.js";
import { presence, subscribeToProfiles, updateOnlineDot } from "./chat/presence.js";
import { startVoiceCall, startVideoCall, acceptCall, rejectCall, endCall } from "./calls/calls.js";
import { listenForIncomingCalls } from "./calls/signaling.js";

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", async () => {
  // Check auth
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { window.location.href = "user_login.html"; return; }
  state.currentUser = session.user;

  // Initialize presence
  await presence("online");
  await loadRooms();
  subscribeToProfiles();

  // Deep-link
  const rp = new URLSearchParams(window.location.search).get("room");
  if (rp) {
    const { data: room } = await supabase.from("chat_rooms").select("user_one_id,user_two_id").eq("id", rp).single();
    if (room) openRoom(rp, room.user_one_id === state.currentUser.id ? room.user_two_id : room.user_one_id);
    else { alert("Chat room not found."); window.history.replaceState({}, document.title, window.location.pathname); }
  }

  // Search
  $("searchInput").addEventListener("input", () => filterRooms($("searchInput").value));

  // Room list click delegation
  $("roomList").addEventListener("click", (e) => {
    const item = e.target.closest(".thread-item");
    if (!item || !item.dataset.roomId) return;
    openRoom(item.dataset.roomId, item.dataset.otherId);
  });

  // Back arrow
  $("backArrow").addEventListener("click", closeRoom);

  // New chat FAB
  $("newChatBtn").addEventListener("click", () => import("./chat/rooms.js").then(m => m.showFriendsOverlay()));
  // Friends overlay close (handled inside rooms.js)

  // Send button & Enter
  $("sendBtn").addEventListener("click", sendMsg);
  $("msgInput").addEventListener("keydown", (e) => { if (e.key === "Enter") sendMsg(); });

  // Cancel reply
  $("cancelReply").addEventListener("click", () => {
    state.replyTo = null;
    $("replyStrip").classList.remove("open");
  });

  // Context menu actions are inside messages.js

  // Home button
  $("homeBtn").addEventListener("click", () => { window.location.href = "index.html"; });

  // Heartbeat
  setInterval(() => { loadRooms(); }, 30000);

  // Realtime: chat_rooms changes
  supabase.channel("public:chat_rooms")
    .on("postgres_changes", { event: "*", schema: "public", table: "chat_rooms" }, () => loadRooms())
    .subscribe();

  // ---- Call button bindings ----
  $("voiceCallBtn")?.addEventListener("click", startVoiceCall);
  $("videoCallBtn")?.addEventListener("click", startVideoCall);

  // Incoming call listener
  listenForIncomingCalls();
});