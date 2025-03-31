// WebRTC Configuration
const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

// Global variables
let localStream;
let remoteStream;
let peerConnection;
let isCaller = false;
let currentPin = '';
let socket;

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('localVideo')) {
    initVideoCall();
  }
});

// Initialize video call functionality
function initVideoCall() {
  // Get URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  currentPin = urlParams.get('pin') || '';
  
  // Set up button event listeners
  document.getElementById('toggleVideo').addEventListener('click', toggleVideo);
  document.getElementById('toggleAudio').addEventListener('click', toggleAudio);
  document.getElementById('shareScreen').addEventListener('click', toggleScreenShare);
  document.getElementById('endCall').addEventListener('click', endCall);
  
  // Check if we're the caller (person who created the PIN)
  isCaller = localStorage.getItem('createdPin') === currentPin;
  if (isCaller) localStorage.removeItem('createdPin');
  
  // Initialize WebRTC
  setupWebRTC();
}

// Set up WebRTC connection
async function setupWebRTC() {
  try {
    // Get local media stream
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    });
    
    // Display local video stream
    const localVideo = document.getElementById('localVideo');
    localVideo.srcObject = localStream;
    
    // Create peer connection
    peerConnection = new RTCPeerConnection(configuration);
    
    // Add local stream to peer connection
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });
    
    // Set up event handlers
    peerConnection.ontrack = event => {
      const remoteVideo = document.getElementById('remoteVideo');
      remoteStream = event.streams[0];
      remoteVideo.srcObject = remoteStream;
    };
    
    peerConnection.onicecandidate = event => {
      if (event.candidate) {
        // In a real app, send ICE candidate to remote peer via signaling server
        console.log('ICE candidate:', event.candidate);
      }
    };
    
    peerConnection.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', peerConnection.iceConnectionState);
    };
    
    // Start signaling process
    if (isCaller) {
      await createOffer();
    }
    
  } catch (error) {
    console.error('Error setting up WebRTC:', error);
    alert('Could not access camera/microphone. Please check permissions.');
  }
}

// Create offer for WebRTC connection
async function createOffer() {
  try {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    
    // In a real app, send offer to remote peer via signaling server
    console.log('Created offer:', offer);
    
  } catch (error) {
    console.error('Error creating offer:', error);
  }
}

// Toggle video stream
function toggleVideo() {
  const videoTracks = localStream.getVideoTracks();
  if (videoTracks.length > 0) {
    const isEnabled = videoTracks[0].enabled;
    videoTracks[0].enabled = !isEnabled;
    document.getElementById('toggleVideo').classList.toggle('bg-white/10');
    document.getElementById('toggleVideo').classList.toggle('bg-pink-600');
  }
}

// Toggle audio stream
function toggleAudio() {
  const audioTracks = localStream.getAudioTracks();
  if (audioTracks.length > 0) {
    const isEnabled = audioTracks[0].enabled;
    audioTracks[0].enabled = !isEnabled;
    document.getElementById('toggleAudio').classList.toggle('bg-white/10');
    document.getElementById('toggleAudio').classList.toggle('bg-pink-600');
  }
}

// Toggle screen sharing
async function toggleScreenShare() {
  try {
    if (!localStream) return;
    
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack.readyState === 'ended') {
      // Currently not sharing screen, start sharing
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      });
      
      const screenTrack = screenStream.getVideoTracks()[0];
      const sender = peerConnection.getSenders().find(s => s.track.kind === 'video');
      
      if (sender) {
        await sender.replaceTrack(screenTrack);
        videoTrack.stop();
        
        screenTrack.onended = () => {
          toggleScreenShare();
        };
        
        document.getElementById('shareScreen').classList.add('bg-green-600');
      }
    } else {
      // Currently sharing screen, switch back to camera
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      });
      
      const cameraTrack = cameraStream.getVideoTracks()[0];
      const sender = peerConnection.getSenders().find(s => s.track.kind === 'video');
      
      if (sender) {
        await sender.replaceTrack(cameraTrack);
        localStream.getVideoTracks()[0].stop();
        
        document.getElementById('shareScreen').classList.remove('bg-green-600');
      }
    }
  } catch (error) {
    console.error('Error toggling screen share:', error);
  }
}

// End the call
function endCall() {
  if (peerConnection) {
    peerConnection.close();
  }
  
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
  }
  
  if (remoteStream) {
    remoteStream.getTracks().forEach(track => track.stop());
  }
  
  window.location.href = 'index.html';
}

// Handle window close/beforeunload
window.addEventListener('beforeunload', endCall);

// Simulated signaling for demo purposes
function simulateSignaling() {
  // In a real app, this would connect to a WebSocket server
  // and handle offer/answer/candidate exchange
  console.log('Signaling would happen here in a real app');
}