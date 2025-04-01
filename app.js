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
    // Get local media stream with optimized constraints
    localStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 }
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
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

// Toggle video stream with better state management
function toggleVideo() {
  const videoTracks = localStream.getVideoTracks();
  if (videoTracks.length > 0) {
    const isEnabled = videoTracks[0].enabled;
    videoTracks[0].enabled = !isEnabled;
    
    const toggleBtn = document.getElementById('toggleVideo');
    toggleBtn.classList.toggle('bg-white/10');
    toggleBtn.classList.toggle('bg-pink-600');
    toggleBtn.innerHTML = isEnabled 
      ? '<i class="fas fa-video-slash"></i>' 
      : '<i class="fas fa-video"></i>';
    
    // Update UI for remote peer
    socket.emit('video-state', { enabled: !isEnabled });
  }
}

// Toggle audio stream with better state management
function toggleAudio() {
  const audioTracks = localStream.getAudioTracks();
  if (audioTracks.length > 0) {
    const isEnabled = audioTracks[0].enabled;
    audioTracks[0].enabled = !isEnabled;
    
    const toggleBtn = document.getElementById('toggleAudio');
    toggleBtn.classList.toggle('bg-white/10');
    toggleBtn.classList.toggle('bg-pink-600');
    toggleBtn.innerHTML = isEnabled 
      ? '<i class="fas fa-microphone-slash"></i>' 
      : '<i class="fas fa-microphone"></i>';
    
    // Update UI for remote peer
    socket.emit('audio-state', { enabled: !isEnabled });
  }
}

// Enhanced screen sharing with error handling
let screenStream = null;

async function toggleScreenShare() {
  try {
    const shareBtn = document.getElementById('shareScreen');
    const videoSender = peerConnection.getSenders().find(s => s.track?.kind === 'video');
    
    if (!shareBtn.classList.contains('bg-green-600')) {
      // Start screen sharing
      screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: false
      });
      
      const screenTrack = screenStream.getVideoTracks()[0];
      await videoSender.replaceTrack(screenTrack);
      
      // Update UI
      shareBtn.classList.add('bg-green-600');
      shareBtn.innerHTML = '<i class="fas fa-times"></i> Stop Sharing';
      
      // Handle when user stops sharing via browser UI
      screenTrack.onended = () => {
        stopScreenShare();
      };
      
    } else {
      // Stop screen sharing
      await stopScreenShare();
    }
  } catch (error) {
    console.error('Screen sharing error:', error);
    alert('Failed to share screen. Please try again.');
  }
}

async function stopScreenShare() {
  const shareBtn = document.getElementById('shareScreen');
  const videoSender = peerConnection.getSenders().find(s => s.track?.kind === 'video');
  
  // Get original camera stream
  const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
  const cameraTrack = cameraStream.getVideoTracks()[0];
  
  // Replace screen track with camera track
  await videoSender.replaceTrack(cameraTrack);
  
  // Stop screen tracks
  if (screenStream) {
    screenStream.getTracks().forEach(track => track.stop());
    screenStream = null;
  }
  
  // Update UI
  shareBtn.classList.remove('bg-green-600');
  shareBtn.innerHTML = '<i class="fas fa-desktop"></i> Share Screen';
  
  // Stop the unused camera track (we already have the original stream)
  cameraTrack.stop();
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