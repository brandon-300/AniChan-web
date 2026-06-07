export function createPeerConnection() {
  return new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun1.l.google.com:19302" }]
  });
}

export function addTracks(stream, pc) {
  stream.getTracks().forEach(track => pc.addTrack(track, stream));
}

export async function createOffer(pc) {
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  return pc.localDescription;
}

export async function createAnswer(pc) {
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  return pc.localDescription;
}

export async function setLocalDescription(pc, desc) {
  await pc.setLocalDescription(desc);
}

export async function setRemoteDescription(pc, desc) {
  await pc.setRemoteDescription(new RTCSessionDescription(desc));
}

export function receiveRemoteStream(pc, videoElement) {
  pc.ontrack = (event) => {
    videoElement.srcObject = event.streams[0];
  };
}

export function closePeerConnection(pc) {
  pc.close();
}