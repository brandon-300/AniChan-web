import { supabase } from "../supabase.js";
import { state } from "../state.js";

const $ = (id) => document.getElementById(id);
const DELETED_KEY = "anichan_deleted_msgs";

function esc(t) { return String(t).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[m]); }
function fmtTimeOnly(iso) { if (!iso) return ''; return new Date(iso).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); }
function fmtDate(iso) { if (!iso) return ''; return new Date(iso).toLocaleDateString(undefined, {month:'short', day:'numeric', year:'numeric'}); }

export function getDel() { try { return new Set(JSON.parse(localStorage.getItem(DELETED_KEY) || '[]')); } catch { return new Set(); } }
export function addDel(id) { const s = getDel(); s.add(id); localStorage.setItem(DELETED_KEY, JSON.stringify([...s])); }

export async function loadMsgs(roomId) {
  const { data, error } = await supabase
    .from("messages").select("*")
    .eq("room_id", roomId).order("created_at", { ascending: true });
  if (error) { console.error(error); return; }

  state.sentIds.clear();
  const del = getDel();
  const unreadIds = new Set(
    data.filter(m =>
      m.receiver_id === state.currentUser.id &&
      !m.is_read &&
      !m.is_deleted &&
      !del.has(m.id)
    ).map(m => m.id)
  );

  renderMsgs(data, unreadIds);

  if (unreadIds.size > 0) {
    await supabase.rpc("mark_messages_read", { room_id: roomId });
    const room = state.rooms.find(r => r.id === roomId);
    if (room) room.unread_count = 0;
    const activeItem = document.querySelector(`.thread-item[data-room-id="${roomId}"]`);
    if (activeItem) { const pill = activeItem.querySelector(".unread-pill"); if (pill) pill.remove(); }
  }
}

export function renderMsgs(msgs, unreadIds = new Set()) {
  $("msgFeed").innerHTML = "";
  const del = getDel();
  let lastDate = "";
  let separatorInserted = false;

  msgs.filter(m => !del.has(m.id)).forEach(msg => {
    const msgDate = fmtDate(msg.created_at);
    if (msgDate && msgDate !== lastDate) {
      const sep = document.createElement("div");
      sep.className = "date-separator";
      sep.textContent = msgDate;
      $("msgFeed").appendChild(sep);
      lastDate = msgDate;
    }

    if (!separatorInserted && unreadIds.has(msg.id)) {
      const unreadCount = unreadIds.size;
      const uSep = document.createElement("div");
      uSep.className = "unread-separator";
      uSep.textContent = `${unreadCount} unread message${unreadCount > 1 ? "s" : ""}`;
      $("msgFeed").appendChild(uSep);
      separatorInserted = true;
    }

    addMsg(msg);
  });

  setTimeout(() => {
    const uSep = $("msgFeed").querySelector(".unread-separator");
    if (uSep) {
      uSep.scrollIntoView({ block: "center", behavior: "smooth" });
    } else {
      $("msgFeed").scrollTop = $("msgFeed").scrollHeight;
    }
  }, 600);
}

export function addMsg(msg, feed = $("msgFeed")) {
  const out = msg.sender_id === state.currentUser.id;

  if (msg.is_deleted) {
    const row = document.createElement("div");
    row.className = `msg-row ${out ? "out" : "in"}`;
    const p = document.createElement("div");
    p.className = "deleted-note";
    p.textContent = "This message was deleted";
    row.appendChild(p);
    feed.appendChild(row);
    return;
  }

  const row = document.createElement("div");
  row.className = `msg-row ${out ? "out" : "in"}`;
  row.dataset.msgId = msg.id;
  row.style.position = "relative";

  let replyHtml = "";
  if (msg.reply_to) {
    let quotedText = msg.reply_text || null;
    let quotedName = null;
    if (msg.reply_sender_id) {
      quotedName = msg.reply_sender_id === state.currentUser.id
        ? (state.currentUser?.user_metadata?.full_name || "You")
        : ($("partnerName")?.textContent || "Them");
    }
    if (!quotedText || !quotedName) {
      const orig = feed.querySelector(`.msg-row[data-msg-id="${msg.reply_to}"]`);
      if (orig) {
        if (!quotedText) {
          const bubble = orig.querySelector(".bubble");
          const nodes = [...bubble.childNodes].filter(n => !n.classList?.contains("reply-snip") && n.textContent.trim());
          quotedText = nodes[nodes.length - 1]?.textContent?.trim() || "";
        }
        if (!quotedName) {
          quotedName = orig.classList.contains("out")
            ? (state.currentUser?.user_metadata?.full_name || "You")
            : ($("partnerName")?.textContent || "Them");
        }
      }
    }
    quotedText = quotedText || "(message)";
    quotedName = quotedName || "Unknown";
    replyHtml = `
      <div class="reply-snip" data-reply-target="${msg.reply_to}" style="cursor:pointer;">
        <div class="reply-user">${esc(quotedName)}</div>
        <div class="reply-body">${esc(quotedText)}</div>
      </div>`;
  }

  let content = esc(msg.message || "");
  const editedHtml = (msg.edited_at || msg.is_edited)
    ? '<span class="edited-label">(edited)</span>'
    : "";

  const iconSide = out ? "left" : "right";
  const replyIconHtml = `<span class="material-symbols-outlined swipe-reply-icon" style="${iconSide}:-28px">reply</span>`;

  row.innerHTML = `
    ${replyIconHtml}
    <div class="bubble">
      ${replyHtml}
      ${content}
      ${editedHtml}
    </div>
    <div class="msg-foot">
      <span>${fmtTimeOnly(msg.created_at)}</span>
      ${out ? '<span class="material-symbols-outlined tick-icon read" style="font-size:14px">done_all</span>' : ""}
    </div>`;

  attachSwipe(row, msg);

  const snip = row.querySelector(".reply-snip");
  if (snip) {
    snip.addEventListener("click", e => {
      e.stopPropagation();
      const targetId = snip.dataset.replyTarget;
      const targetRow = feed.querySelector(`.msg-row[data-msg-id="${targetId}"]`);
      if (targetRow) {
        targetRow.scrollIntoView({ behavior: "smooth", block: "center" });
        targetRow.classList.remove("reply-highlight");
        void targetRow.offsetWidth;
        targetRow.classList.add("reply-highlight");
        setTimeout(() => targetRow.classList.remove("reply-highlight"), 1200);
      }
    });
  }

  let rowLongTimer;
  row.addEventListener("touchstart", e => { rowLongTimer = setTimeout(() => showCtx(e, msg), 500); }, { passive: true });
  row.addEventListener("touchend",   () => clearTimeout(rowLongTimer));
  row.addEventListener("touchmove",  () => clearTimeout(rowLongTimer));

  feed.appendChild(row);
}

function attachSwipe(el, msg) {
  let sx = 0, dragging = false;
  const icon = el.querySelector(".swipe-reply-icon");
  const THRESHOLD = 72;

  el.addEventListener("touchstart", e => { sx = e.touches[0].clientX; dragging = true; }, { passive: true });
  el.addEventListener("touchmove", e => {
    if (!dragging) return;
    const dx = e.touches[0].clientX - sx;
    const progress = Math.max(0, Math.min(dx, THRESHOLD)) / THRESHOLD;
    if (dx > 8) {
      el.style.transform = `translateX(${Math.min(dx, THRESHOLD)}px)`;
      if (icon) icon.style.opacity = String(progress);
    }
  }, { passive: true });
  el.addEventListener("touchend", e => {
    if (!dragging) return;
    dragging = false;
    const dx = (e.changedTouches[0]?.clientX || sx) - sx;
    el.style.transform = "";
    if (icon) icon.style.opacity = "0";
    if (dx >= THRESHOLD) setReply(msg);
  });
}

function setReply(msg) {
  if (msg.is_deleted) return;
  const out = msg.sender_id === state.currentUser.id;
  const senderName = out
    ? (state.currentUser?.user_metadata?.full_name || "You")
    : ($("partnerName")?.textContent || "Them");
  state.replyTo = { id: msg.id, sender: msg.sender_id, content: msg.message || "", senderName };
  $("replyStripUser").textContent = senderName;
  $("replyPreview").textContent = state.replyTo.content.substring(0, 80);
  $("replyStrip").classList.add("open");
  $("msgInput").focus();
}

function showCtx(e, msg) {
  if (msg.is_deleted) return;
  const domRow = e.target.closest(".msg-row");
  state.ctxMsgId = domRow ? domRow.dataset.msgId : msg.id;
  const menu = $("ctxMenu");
  const isMine = msg.sender_id === state.currentUser.id;
  const withinEditWindow = (Date.now() - new Date(msg.created_at).getTime()) < 5 * 60 * 1000;

  $("ctxEdit").style.display = (isMine && withinEditWindow) ? "block" : "none";
  $("ctxDelAll").style.display = isMine ? "block" : "none";
  const delAllDivider = $("ctxDelAll").previousElementSibling;
  if (delAllDivider && delAllDivider.classList.contains("split")) {
    delAllDivider.style.display = isMine ? "block" : "none";
  }
  $("ctxDelMe").style.display = "block";

  menu.style.display = "block";
  const tx = e.touches[0];
  menu.style.left = Math.min(tx.clientX, window.innerWidth - 200) + "px";
  menu.style.top  = Math.max(tx.clientY - 120, 10) + "px";
}

export async function sendMsg() {
  const inp = $("msgInput"), txt = inp.value.trim();
  if (!txt || !state.activeRoom || !state.partnerId || state.sending) return;
  inp.value = "";
  state.sending = true;

  clearTimeout(state.typingTimeout);
  import("./typing.js").then(m => m.broadcastTyping(false));

  const tmp = "tmp-" + Date.now();
  const row = document.createElement("div");
  row.className = "msg-row out";
  row.dataset.msgId = tmp;
  row.innerHTML = `<div class="bubble">${esc(txt)}</div><div class="msg-foot"><span style="color:var(--muted)">sending…</span></div>`;
  const tmpMsg = { id: tmp, sender_id: state.currentUser.id, message: txt, created_at: new Date().toISOString(), is_deleted: false };
  let tmpLongTimer;
  row.addEventListener("touchstart", e => { tmpLongTimer = setTimeout(() => showCtx(e, tmpMsg), 500); }, { passive: true });
  row.addEventListener("touchend",   () => clearTimeout(tmpLongTimer));
  row.addEventListener("touchmove",  () => clearTimeout(tmpLongTimer));
  $("msgFeed").appendChild(row);
  $("msgFeed").scrollTop = $("msgFeed").scrollHeight;

  const payload = {
    room_id: state.activeRoom, sender_id: state.currentUser.id, receiver_id: state.partnerId,
    message: txt, msg_type: "text",
    reply_to: state.replyTo?.id || null,
    reply_text: state.replyTo?.content || null,
    reply_sender_id: state.replyTo?.sender || null
  };
  if (state.replyTo) { state.replyTo = null; $("replyStrip").classList.remove("open"); }

  const { data: ins, error } = await supabase.from("messages").insert(payload).select().single();
  const foot = row.querySelector(".msg-foot");
  if (error) {
    foot.innerHTML = '<span style="color:var(--danger)">not sent</span>';
  } else if (ins) {
    state.sentIds.add(ins.id);
    row.dataset.msgId = ins.id;
    foot.innerHTML = `<span>${fmtTimeOnly(ins.created_at)}</span> <span class="material-symbols-outlined tick-icon read" style="font-size:14px">done_all</span>`;
    await supabase.from("chat_rooms").update({ last_message: txt, last_message_time: new Date().toISOString() }).eq("id", state.activeRoom);
    import("./rooms.js").then(m => m.loadRooms());
    clearTimeout(state.typingTimeout);
    import("./typing.js").then(m => m.broadcastTyping(false));
    $("typingIndicator").innerHTML = "";
    setTimeout(() => { $("msgFeed").scrollTop = $("msgFeed").scrollHeight; }, 100);
  }
  state.sending = false;
}

export function subMsgs(roomId) {
  if (state.messageSub) supabase.removeChannel(state.messageSub);
  state.messageSub = supabase.channel(`room:${roomId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` }, payload => {
      if (payload.eventType === "INSERT") {
        const nm = payload.new;
        if (!state.sentIds.has(nm.id) && !document.querySelector(`.msg-row[data-msg-id="${nm.id}"]`)) {
          addMsg(nm);
          $("msgFeed").scrollTop = $("msgFeed").scrollHeight;
          if (nm.receiver_id === state.currentUser.id) {
            supabase.from("messages").update({ is_read: true }).eq("id", nm.id).then();
          }
          import("./rooms.js").then(m => m.loadRooms());
        }
      } else if (payload.eventType === "UPDATE") {
        loadMsgs(roomId);
        import("./rooms.js").then(m => m.loadRooms());
      }
    }).subscribe();
}