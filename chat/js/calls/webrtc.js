export function createPeerConnection() {
  return new RTCPeerConnection({ iceServers: [{ urls: "stun:stun1.l.google.com:19302" }] });
}
export function addTracks(stream, pc) { stream.getTracks().forEach(t => pc.addTrack(t, stream)); }
export async function createOffer(pc) { const o = await pc.createOffer(); await pc.setLocalDescription(o); return pc.localDescription; }
export async function createAnswer(pc) { const a = await pc.createAnswer(); await pc.setLocalDescription(a); return pc.localDescription; }
export async function setLocalDescription(pc, desc) { await pc.setLocalDescription(desc); }
export async function setRemoteDescription(pc, desc) { await pc.setRemoteDescription(new RTCSessionDescription(desc)); }
export function receiveRemoteStream(pc, videoEl) { pc.ontrack = (e) => { videoEl.srcObject = e.streams[0]; }; }
export function closePeerConnection(pc) { pc.close(); }