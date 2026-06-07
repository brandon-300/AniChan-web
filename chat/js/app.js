import { supabase } from "./supabase.js";
import { state } from "./state.js";
import { loadRooms, filterRooms, openRoom, closeRoom, showFriendsOverlay } from "./chat/rooms.js";
import { loadMsgs, sendMsg, subMsgs } from "./chat/messages.js";
import { setupBroadcastChannel, broadcastTyping, handleTypingBroadcast } from "./chat/typing.js";
import { presence, subscribeToProfiles } from "./chat/presence.js";
import { startVoiceCall, startVideoCall } from "./calls/calls.js";
import { listenForIncomingCalls } from "./calls/signaling.js";

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Auth check
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { window.location.href = "../user_login.html"; return; }
  state.currentUser = session.user;

  // 2. Initialise presence & load rooms
  await presence("online");
  await loadRooms();
  subscribeToProfiles();

  // 3. Deep-link via ?room=
  const rp = new URLSearchParams(window.location.search).get("room");
  if (rp) {
    const { data: room } = await supabase.from("chat_rooms").select("user_one_id,user_two_id").eq("id", rp).single();
    if (room) {
      openRoom(rp, room.user_one_id === state.currentUser.id ? room.user_two_id : room.user_one_id);
    } else {
      alert("Chat room not found.");
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  // 4. UI bindings
  $("searchInput").addEventListener("input", () => filterRooms($("searchInput").value));

  $("roomList").addEventListener("click", (e) => {
    const item = e.target.closest(".thread-item");
    if (!item || !item.dataset.roomId) return;
    openRoom(item.dataset.roomId, item.dataset.otherId);
  });

  $("backArrow").addEventListener("click", closeRoom);
  $("newChatBtn").addEventListener("click", () => showFriendsOverlay());
  $("sendBtn").addEventListener("click", sendMsg);
  $("msgInput").addEventListener("keydown", (e) => { if (e.key === "Enter") sendMsg(); });

  $("cancelReply").addEventListener("click", () => {
    state.replyTo = null;
    $("replyStrip").classList.remove("open");
  });

  $("homeBtn").addEventListener("click", () => { window.location.href = "../index.html"; });

  // Typing listener
  $("msgInput").addEventListener("input", () => {
    if (!state.broadcastChannel || !state.activeRoom) return;
    broadcastTyping(true);
    clearTimeout(state.typingTimeout);
    state.typingTimeout = setTimeout(() => broadcastTyping(false), 2000);
  });

  // Context menu bindings
  document.addEventListener("click", (e) => { if (!$("ctxMenu").contains(e.target)) $("ctxMenu").style.display = "none"; });
  $("ctxEdit").addEventListener("click", () => {
    $("ctxMenu").style.display = "none";
    if (state.ctxMsgId && state.ctxMsgId.startsWith("tmp-")) {
      alert("Message is still sending — please wait a moment and try again.");
      return;
    }
    const c = prompt("Edit message:");
    if (!c || !c.trim()) return;
    supabase.from("messages").update({ message: c.trim(), edited_at: new Date().toISOString(), is_edited: true }).eq("id", state.ctxMsgId)
      .then(({ error }) => { if (error) alert("Edit failed"); else loadMsgs(state.activeRoom); });
  });
  $("ctxDelMe").addEventListener("click", () => {
    $("ctxMenu").style.display = "none";
    import("./chat/messages.js").then(m => m.addDel(state.ctxMsgId));
    loadMsgs(state.activeRoom);
  });
  $("ctxDelAll").addEventListener("click", () => {
    $("ctxMenu").style.display = "none";
    if (!confirm("Delete for everyone?")) return;
    supabase.from("messages").update({ is_deleted: true }).eq("id", state.ctxMsgId)
      .then(({ error }) => { if (error) alert("Delete failed"); else loadMsgs(state.activeRoom); });
  });
  $("ctxCancel").addEventListener("click", () => { $("ctxMenu").style.display = "none"; });

  // Call buttons
  $("voiceCallBtn")?.addEventListener("click", startVoiceCall);
  $("videoCallBtn")?.addEventListener("click", startVideoCall);
  $("muteBtn")?.addEventListener("click", () => import("./calls/calls.js").then(m => m.toggleMute()));
  $("cameraBtn")?.addEventListener("click", () => import("./calls/calls.js").then(m => m.toggleCamera()));

  listenForIncomingCalls();

  // 5. Heartbeat
  setInterval(() => { loadRooms(); }, 30000);

  // 6. Realtime
  supabase.channel("public:chat_rooms")
    .on("postgres_changes", { event: "*", schema: "public", table: "chat_rooms" }, () => loadRooms())
    .subscribe();
});