import { supabase } from "../supabase.js";
import { state } from "../state.js";
import { loadMsgs, subMsgs } from "./messages.js";
const $ = (id) => document.getElementById(id);

const DEFAULT_AVATAR = "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#2a2a2a"/><text x="50%" y="55%" font-family="sans-serif" font-size="40" fill="#666" text-anchor="middle" dominant-baseline="middle">?</text></svg>');

function esc(t) { return String(t).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[m]); }
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

export async function loadRooms() {
  if (!state.currentUser) return;
  const { data, error } = await supabase
    .from("chat_rooms")
    .select(`id,last_message,last_message_time,user_one_id,user_two_id,
      user_one:profiles!chat_rooms_user_one_id_fkey(id,username,full_name,avatar_url,is_online,last_seen),
      user_two:profiles!chat_rooms_user_two_id_fkey(id,username,full_name,avatar_url,is_online,last_seen)`)
    .or(`user_one_id.eq.${state.currentUser.id},user_two_id.eq.${state.currentUser.id}`)
    .order("last_message_time", { ascending: false });
  if (error) { console.error(error); return; }

  const enriched = [];
  for (const room of data) {
    const partner = room.user_one_id === state.currentUser.id ? room.user_two : room.user_one;
    const { count } = await supabase
      .from("messages").select("*", { count: "exact", head: true })
      .eq("room_id", room.id)
      .eq("receiver_id", state.currentUser.id)
      .eq("is_read", false)
      .eq("is_deleted", false);
    enriched.push({
      id: room.id,
      last_message: room.last_message,
      last_message_time: room.last_message_time,
      other_user: partner,
      unread_count: count || 0,
    });
  }
  state.rooms = enriched;
  filterRooms($("searchInput").value);
}

export function filterRooms(q) {
  const t = q.trim().toLowerCase();
  state.filteredRooms = t
    ? state.rooms.filter(r => (r.other_user.full_name || r.other_user.username).toLowerCase().includes(t))
    : [...state.rooms];
  renderRooms(state.filteredRooms);
}

function renderRooms(data) {
  const list = $("roomList");
  list.innerHTML = "";
  if (!data.length) {
    list.innerHTML = '<div style="padding:24px 16px;color:var(--muted);text-align:center;font-size:14px">No conversations yet</div>';
    return;
  }
  data.forEach(room => {
    const o = room.other_user;
    const isTyping = state.typingUsers.has(o.id);
    const d = document.createElement("div");
    d.className = "thread-item" + (state.activeRoom === room.id ? " active" : "");
    d.dataset.roomId  = room.id;
    d.dataset.otherId = o.id;

    const previewHtml = isTyping
      ? `<p class="thread-preview typing-preview">typing...</p>`
      : `<p class="thread-preview">${esc(room.last_message || "")}</p>`;

    const unreadHtml = room.unread_count
      ? `<span class="unread-pill">${room.unread_count}</span>`
      : "";

    d.innerHTML = `
      <div class="avatar-ctn">
        <img src="${o.avatar_url || DEFAULT_AVATAR}" onerror="this.src='${DEFAULT_AVATAR}'" alt="" />
        <div class="online-marker${o.is_online ? " live" : ""}"></div>
      </div>
      <div class="thread-info">
        <div class="thread-top">
          <span class="thread-name">${esc(o.full_name || o.username)}</span>
          <span class="thread-time">${fmtChat(room.last_message_time)}</span>
        </div>
        <div class="thread-bottom">
          ${previewHtml}
          ${unreadHtml}
        </div>
      </div>`;
    list.appendChild(d);
  });
}

export async function openRoom(roomId, otherId) {
  state.activeRoom = roomId;
  state.partnerId  = otherId;

  if (window.innerWidth <= 768) $("appRoot").classList.add("chat-open");

  const activeItem = document.querySelector(`.thread-item[data-room-id="${roomId}"]`);
  if (activeItem) {
    const pill = activeItem.querySelector(".unread-pill");
    if (pill) pill.remove();
  }

  $("emptyState").style.display = "none";
  $("chatTopbar").style.display = "flex";
  $("composeArea").style.display = "flex";

  $("partnerDot").classList.remove("live");
  $("partnerSub").textContent = "";
  $("partnerSub").classList.remove("typing-status");

  const { data: p } = await supabase
    .from("profiles").select("username,full_name,avatar_url,is_online,last_seen")
    .eq("id", otherId).single();
  if (p) {
    $("partnerPic").src = p.avatar_url || DEFAULT_AVATAR;
    $("partnerName").textContent = p.full_name || p.username;
    setPartnerStatus(p.is_online, p.last_seen);
    $("partnerLink").href = `profile.html?user=${otherId}`;
  }

  import("./typing.js").then(m => m.setupBroadcastChannel(roomId));
  renderRooms(state.filteredRooms);
  await loadMsgs(roomId);
  subMsgs(roomId);
  $("typingIndicator").innerHTML = "";
}

export function closeRoom() {
  $("appRoot").classList.remove("chat-open");
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

export async function showFriendsOverlay() {
  const { data: friends } = await supabase.from("profiles").select("id,username,full_name,avatar_url").neq("id", state.currentUser.id).order("username");
  const list = $("friendsList");
  list.innerHTML = "";
  if (!friends || !friends.length) {
    list.innerHTML = '<div style="padding:16px;color:var(--muted);text-align:center">No other users found</div>';
  } else {
    friends.forEach(f => {
      const div = document.createElement("div");
      div.className = "friend-item";
      div.innerHTML = `
        <img class="friend-avatar" src="${f.avatar_url || DEFAULT_AVATAR}" onerror="this.src='${DEFAULT_AVATAR}'" alt="" />
        <div>
          <div class="friend-name">${esc(f.full_name || f.username)}</div>
          <div class="friend-username">@${esc(f.username)}</div>
        </div>`;
      div.addEventListener("click", () => {
        $("friendsOverlay").classList.remove("open");
        startOrOpenChat(f);
      });
      list.appendChild(div);
    });
  }
  $("friendsOverlay").classList.add("open");
}

export async function startOrOpenChat(friend) {
  const { data: exist } = await supabase.from("chat_rooms").select("id")
    .or(`and(user_one_id.eq.${state.currentUser.id},user_two_id.eq.${friend.id}),and(user_one_id.eq.${friend.id},user_two_id.eq.${state.currentUser.id})`)
    .maybeSingle();
  if (exist) {
    openRoom(exist.id, friend.id);
  } else {
    const { data: nr, error } = await supabase.from("chat_rooms").insert({ user_one_id: state.currentUser.id, user_two_id: friend.id }).select("id").single();
    if (error) { alert("Could not start chat"); return; }
    loadRooms();
    openRoom(nr.id, friend.id);
  }
}

// Friend overlay close handlers (bind here because they exist on page)
document.getElementById("closeFriends")?.addEventListener("click", () => $("friendsOverlay").classList.remove("open"));
document.getElementById("friendsOverlay")?.addEventListener("click", (e) => { if (e.target.id === "friendsOverlay") $("friendsOverlay").classList.remove("open"); });
document.getElementById("addMoreBtn")?.addEventListener("click", () => window.location.href = "find_friends.html");