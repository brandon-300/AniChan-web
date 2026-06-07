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
  if (!session) {
    window.location.href = "../user_login.html";   // go up to root
    return;
  }
  state.currentUser = session.user;

  // 2. Initialise presence & load rooms
  await presence("online");
  await loadRooms();
  subscribeToProfiles();

  // 3. Deep-link from another page (?room=...)
  const rp = new URLSearchParams(window.location.search).get("room");
  if (rp) {
    const { data: room } = await supabase
      .from("chat_rooms")
      .select("user_one_id,user_two_id")
      .eq("id", rp)
      .single();
    if (room) {
      openRoom(
        rp,
        room.user_one_id === state.currentUser.id
          ? room.user_two_id
          : room.user_one_id
      );
    } else {
      alert("Chat room not found.");
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  // 4. UI event bindings
  // Search in thread list
  $("searchInput").addEventListener("input", () =>
    filterRooms($("searchInput").value)
  );

  // Click on a thread item (delegation)
  $("roomList").addEventListener("click", (e) => {
    const item = e.target.closest(".thread-item");
    if (!item || !item.dataset.roomId) return;
    openRoom(item.dataset.roomId, item.dataset.otherId);
  });

  // Back arrow (close conversation, return to room list)
  $("backArrow").addEventListener("click", closeRoom);

  // New chat FAB – open friends overlay
  $("newChatBtn").addEventListener("click", () => showFriendsOverlay());

  // Send message
  $("sendBtn").addEventListener("click", sendMsg);
  $("msgInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMsg();
  });

  // Cancel reply
  $("cancelReply").addEventListener("click", () => {
    state.replyTo = null;
    $("replyStrip").classList.remove("open");
  });

  // Home button → root index
  $("homeBtn").addEventListener("click", () => {
    window.location.href = "../index.html";
  });

  // ---- Voice/Video Call buttons ----
  $("voiceCallBtn")?.addEventListener("click", startVoiceCall);
  $("videoCallBtn")?.addEventListener("click", startVideoCall);
  $("muteBtn")?.addEventListener("click", () =>
    import("./calls/calls.js").then((m) => m.toggleMute())
  );
  $("cameraBtn")?.addEventListener("click", () =>
    import("./calls/calls.js").then((m) => m.toggleCamera())
  );

  // Listen for incoming calls
  listenForIncomingCalls();

  // 5. Heartbeat: refresh room list every 30s
  setInterval(() => {
    loadRooms();
  }, 30000);

  // 6. Realtime: chat_rooms table changes → refresh room list
  supabase
    .channel("public:chat_rooms")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "chat_rooms" },
      () => loadRooms()
    )
    .subscribe();
});