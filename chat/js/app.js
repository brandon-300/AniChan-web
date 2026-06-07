import { supabase } from "./supabase.js";
import { state } from "./state.js";
import { loadRooms, filterRooms, openRoom, closeRoom } from "./chat/rooms.js";
import { loadMsgs, sendMsg, subMsgs } from "./chat/messages.js";
import { presence, subscribeToProfiles } from "./chat/presence.js";
import { startVoiceCall, startVideoCall } from "./calls/calls.js";
import { listenForIncomingCalls } from "./calls/signaling.js";

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { window.location.href = "user_login.html"; return; }
  state.currentUser = session.user;

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

  $("searchInput").addEventListener("input", () => filterRooms($("searchInput").value));
  $("roomList").addEventListener("click", e => {
    const item = e.target.closest(".thread-item");
    if (!item || !item.dataset.roomId) return;
    openRoom(item.dataset.roomId, item.dataset.otherId);
  });
  $("backArrow").addEventListener("click", closeRoom);
  $("newChatBtn").addEventListener("click", () => import("./chat/rooms.js").then(m => m.showFriendsOverlay()));
  $("sendBtn").addEventListener("click", sendMsg);
  $("msgInput").addEventListener("keydown", e => { if (e.key === "Enter") sendMsg(); });
  $("cancelReply").addEventListener("click", () => {
    state.replyTo = null;
    $("replyStrip").classList.remove("open");
  });
  $("homeBtn").addEventListener("click", () => { window.location.href = "index.html"; });

  // Call buttons
  $("voiceCallBtn")?.addEventListener("click", startVoiceCall);
  $("videoCallBtn")?.addEventListener("click", startVideoCall);
  $("muteBtn")?.addEventListener("click", () => import("./calls/calls.js").then(m => m.toggleMute()));
  $("cameraBtn")?.addEventListener("click", () => import("./calls/calls.js").then(m => m.toggleCamera()));

  listenForIncomingCalls();

  setInterval(() => { loadRooms(); }, 30000);
  supabase.channel("public:chat_rooms")
    .on("postgres_changes", { event: "*", schema: "public", table: "chat_rooms" }, () => loadRooms())
    .subscribe();
});