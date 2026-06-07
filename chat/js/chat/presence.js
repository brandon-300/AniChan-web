import { supabase } from "../supabase.js";
import { state } from "../state.js";
import { filterRooms } from "./rooms.js";
const $ = (id) => document.getElementById(id);

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

export async function presence(status = "online") {
  if (!state.currentUser) return;
  await supabase.from("user_presence").upsert({ user_id: state.currentUser.id, status, last_active: new Date().toISOString() });
  await supabase.from("profiles").update({ is_online: status === "online", last_seen: new Date().toISOString() }).eq("id", state.currentUser.id);
}

export function subscribeToProfiles() {
  if (state.profilesSub) supabase.removeChannel(state.profilesSub);
  state.profilesSub = supabase.channel("profile-is-online-changes")
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, payload => {
      const updated = payload.new;
      const partnerIds = new Set(state.rooms.map(r => r.other_user.id));
      if (!partnerIds.has(updated.id)) return;
      updateOnlineDot(updated.id, !!updated.is_online, updated.last_seen);
    })
    .subscribe();

  if (state.presenceSub) supabase.removeChannel(state.presenceSub);
  state.presenceSub = supabase.channel("online-users", { config: { presence: { key: state.currentUser.id } } });
  state.presenceSub
    .on("presence", { event: "sync" }, () => {
      const presenceState = state.presenceSub.presenceState();
      state.rooms.forEach(room => {
        if (presenceState[room.other_user.id]) updateOnlineDot(room.other_user.id, true);
      });
    })
    .on("presence", { event: "join" }, ({ key }) => updateOnlineDot(key, true))
    .on("presence", { event: "leave" }, ({ key }) => { /* DB handles offline */ })
    .subscribe(async status => {
      if (status === "SUBSCRIBED") {
        await supabase.from("profiles").update({ is_online: true, last_seen: new Date().toISOString() }).eq("id", state.currentUser.id);
        await state.presenceSub.track({ user_id: state.currentUser.id, online_at: new Date().toISOString() });
      }
    });
}

export function updateOnlineDot(userId, isOnline, lastSeen = null) {
  state.rooms.forEach(room => {
    if (room.other_user.id === userId) {
      room.other_user.is_online = isOnline;
      if (lastSeen) room.other_user.last_seen = lastSeen;
    }
  });
  filterRooms($("searchInput").value);
  if (userId === state.partnerId) {
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
}