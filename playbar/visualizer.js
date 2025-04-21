// Audio context and analyzer setup
let audioContext;
let analyser;
let audioSource;
let audioBuffer;
let audioElement;
let isPlaying = false;
let animationId;
let barCount = 200; // Fixed at 200 as requested
let barSpacing = 1;
let sensitivity = 10; // Fixed at highest setting (10)

// Canvas setup
const canvas = document.getElementById("waveformCanvas");
const ctx = canvas.getContext("2d");
const currentTimeDisplay = document.getElementById("currentTime");
const totalTimeDisplay = document.getElementById("totalTime");

// Buttons and controls
const playBtn = document.getElementById("playBtn");
const uploadBtn = document.getElementById("uploadBtn");
const audioUpload = document.getElementById("audioUpload");
const volumeControl = document.getElementById("volumeControl");

// Customization options
const barColorPicker = document.getElementById("barColor");
const progressColorPicker = document.getElementById("progressColor");
const bgColorPicker = document.getElementById("bgColor");
const barSpacingInput = document.getElementById("barSpacing");

// Set default colors
barColorPicker.value = "#FF0000"; // Red for waveform
progressColorPicker.value = "#000000"; // Black for progress
bgColorPicker.value = "#FFFFFF"; // White for background

// Initialize audio context on user interaction
function initAudio() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;

    // Create a default audio element if it doesn't exist
    if (!audioElement) {
      audioElement = new Audio();
      audioElement.crossOrigin = "anonymous";
    }

    audioSource = audioContext.createMediaElementSource(audioElement);
    audioSource.connect(analyser);
    analyser.connect(audioContext.destination);

    // Set up volume control
    volumeControl.addEventListener("input", function () {
      audioElement.volume = volumeControl.value;
    });

    // Initial volume
    audioElement.volume = volumeControl.value;
  }
}

// Resize canvas to match display size
function resizeCanvas() {
  const containerWidth = canvas.clientWidth;
  const containerHeight = canvas.clientHeight;

  if (canvas.width !== containerWidth || canvas.height !== containerHeight) {
    canvas.width = containerWidth;
    canvas.height = containerHeight;
  }
}

// Format time in MM:SS
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return mins + ":" + (secs < 10 ? "0" : "") + secs;
}

// Update time displays
function updateTimeDisplays() {
  if (audioElement && !isNaN(audioElement.duration)) {
    currentTimeDisplay.textContent = formatTime(audioElement.currentTime);
    totalTimeDisplay.textContent = formatTime(audioElement.duration);
  }
}

// Draw visualization
function drawVisualization() {
  if (!audioContext || !analyser) return;

  animationId = requestAnimationFrame(drawVisualization);
  resizeCanvas();

  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  analyser.getByteFrequencyData(dataArray);

  // Clear the canvas
  ctx.fillStyle = bgColorPicker.value;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Update time displays
  updateTimeDisplays();

  // Calculate bar width based on canvas width and bar count
  const usableWidth = canvas.width - barSpacing * (barCount - 1);
  const barWidth = usableWidth / barCount;

  // Get the sensitivity factor (fixed at highest level)
  const sensitivityFactor = sensitivity / 5; // This will be 2.0

  // Calculate the progress position
  let progressPosition = 0;
  if (
    audioElement &&
    !isNaN(audioElement.duration) &&
    audioElement.duration > 0
  ) {
    progressPosition =
      (audioElement.currentTime / audioElement.duration) * canvas.width;
  }

  // Always use "bars" visualization
  drawBars(dataArray, barWidth, sensitivityFactor, progressPosition);
}

// Draw bars visualization
function drawBars(dataArray, barWidth, sensitivityFactor, progressPosition) {
  const bufferLength = analyser.frequencyBinCount;
  const barColor = barColorPicker.value;
  const progressColor = progressColorPicker.value;

  // Get a subset of the frequency data for the bars
  const step = Math.floor(bufferLength / barCount);

  // Center line is in the middle of the canvas height
  const centerY = canvas.height / 2;

  for (let i = 0; i < barCount; i++) {
    const dataIndex = i * step;
    // Apply sensitivity factor to bar height
    const barHeight =
      (dataArray[dataIndex] / 255) * (canvas.height / 2) * sensitivityFactor;

    const x = i * (barWidth + barSpacing);

    // Determine if this bar is in the played section
    const isPlayed = x <= progressPosition;

    // Set color based on whether this part has been played
    ctx.fillStyle = isPlayed ? progressColor : barColor;

    // Draw bar extending upward from center
    ctx.fillRect(x, centerY - barHeight, barWidth, barHeight);

    // Draw bar extending downward from center
    ctx.fillRect(x, centerY, barWidth, barHeight);
  }
}

// Play/pause audio
function togglePlayback() {
  if (!audioElement || !audioElement.src) {
    alert("Please upload an audio file first!");
    return;
  }

  initAudio();

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }

  if (isPlaying) {
    audioElement.pause();
    playBtn.textContent = "▶";
    cancelAnimationFrame(animationId);
  } else {
    audioElement.play();
    playBtn.textContent = "❚❚";
    drawVisualization();
  }

  isPlaying = !isPlaying;
}

// Load audio file
function loadAudioFile(file) {
  const fileURL = URL.createObjectURL(file);

  // Create new audio element to avoid issues with changing source
  audioElement = new Audio();
  audioElement.crossOrigin = "anonymous";
  audioElement.src = fileURL;

  // If audio context exists, reconnect the new element
  if (audioContext) {
    audioSource = audioContext.createMediaElementSource(audioElement);
    audioSource.connect(analyser);
    analyser.connect(audioContext.destination);
    audioElement.volume = volumeControl.value;
  }

  // Reset state
  isPlaying = false;
  playBtn.textContent = "▶";

  // Show file name
  document.querySelector(".song-title").textContent = file.name.replace(
    /\.[^/.]+$/,
    "",
  );
  document.querySelector(".song-artist").textContent = "Local File";

  // Auto play after loading
  audioElement.onloadedmetadata = function () {
    updateTimeDisplays();
    togglePlayback();
  };
}

// Update settings
function updateSettings() {
  barSpacing = parseInt(barSpacingInput.value);
}

// Event Listeners
playBtn.addEventListener("click", togglePlayback);

uploadBtn.addEventListener("click", function () {
  audioUpload.click();
});

audioUpload.addEventListener("change", function (e) {
  if (e.target.files[0]) {
    loadAudioFile(e.target.files[0]);
    initAudio();
  }
});

// Add click event listener to the canvas for scrubbing
canvas.addEventListener("click", function (event) {
  if (!audioElement || !audioElement.src) return;

  // Get click position relative to canvas
  const rect = canvas.getBoundingClientRect();
  const clickX = event.clientX - rect.left;

  // Calculate the percentage of the width where the click occurred
  const clickPercent = clickX / canvas.width;

  // Set the audio playback position based on the click location
  if (audioElement.duration) {
    audioElement.currentTime = clickPercent * audioElement.duration;

    // If audio was paused, update the visualization immediately
    if (!isPlaying) {
      updateTimeDisplays();
      drawVisualization();
    }
  }
});

// Add hover effect to show this is interactive
canvas.addEventListener("mousemove", function () {
  canvas.style.cursor = "pointer";
});

// Settings change events
barColorPicker.addEventListener("input", updateSettings);
progressColorPicker.addEventListener("input", updateSettings);
bgColorPicker.addEventListener("input", updateSettings);
barSpacingInput.addEventListener("input", updateSettings);

// Initialize audio context when document is loaded
document.addEventListener("DOMContentLoaded", function () {
  initAudio();
});

// Initialize canvas
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// Preload with your audio file
audioElement = new Audio("AF_BullFight_Mockup_Master.wav");

// Debug audio loading
console.log("Attempting to load:", audioElement.src);
audioElement.addEventListener("error", function (e) {
  console.error("Error loading audio:", e);
});

audioElement.addEventListener("loadedmetadata", updateTimeDisplays);
