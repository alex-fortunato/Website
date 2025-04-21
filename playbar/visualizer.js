// Draw live visualization during playback
function drawLiveVisualization(
  dataArray,
  barWidth,
  sensitivityFactor,
  progressPosition,
) {
  const bufferLength = analyser.frequencyBinCount;
  const barColor = barColorPicker.value;
  const progressColor = progressColorPicker.value;

  // Get a subset of the frequency data for the bars
  const step = Math.floor(bufferLength / barCount);

  // Center line is in the middle of the canvas height
  const centerY = canvas.height / 2;

  for (let i = 0; i < barCount; i++) {
    const dataIndex = Math.min(i * step, bufferLength - 1);

    // Get frequency data for this bar
    let value = dataArray[dataIndex];
    if (value === undefined || isNaN(value)) {
      value = 0;
    }

    // Apply sensitivity factor to bar height
    const barHeight = (value / 255) * (canvas.height / 2) * sensitivityFactor;

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
} // Audio context and analyzer setup
let audioContext;
let analyser;
let audioSource;
let audioBuffer;
let audioElement;
let isPlaying = false;
let animationId;
let barCount = 200; // Fixed at 200 as requested
let barSpacing = 1;
let sensitivity = 9; // Fixed at highest setting (10)
let staticWaveformData = null; // Store the pre-analyzed waveform data

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

// Initialize audio context on page load
function initAudio() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024; // Higher FFT size for more detailed visualization

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

// Pre-analyze the audio file to create static waveform data
async function analyzeAudio() {
  if (!audioContext || !audioElement.src) return;

  try {
    // Create a temporary offline audio context for analysis
    const offlineCtx = new OfflineAudioContext(
      1, // Single channel for analysis
      audioElement.duration * audioContext.sampleRate,
      audioContext.sampleRate,
    );

    // Fetch the audio file
    const response = await fetch(audioElement.src);
    const arrayBuffer = await response.arrayBuffer();

    // Decode the audio data
    const audioData = await offlineCtx.decodeAudioData(arrayBuffer);

    // Create buffer source
    const source = offlineCtx.createBufferSource();
    source.buffer = audioData;

    // Create analyzer
    const offlineAnalyser = offlineCtx.createAnalyser();
    offlineAnalyser.fftSize = 1024;

    // Connect source to analyzer
    source.connect(offlineAnalyser);
    offlineAnalyser.connect(offlineCtx.destination);

    // Start the source
    source.start(0);

    // Generate samples across the audio track
    const sampleSize = barCount;
    staticWaveformData = new Array(sampleSize).fill(0);

    // Process the audio in chunks
    const samplesPerBar = Math.floor(audioData.length / sampleSize);

    // Get the audio data
    const channelData = audioData.getChannelData(0);

    // Calculate average amplitude for each segment
    for (let i = 0; i < sampleSize; i++) {
      const startSample = i * samplesPerBar;
      const endSample = Math.min(startSample + samplesPerBar, audioData.length);
      let sum = 0;

      // Calculate average amplitude
      for (let j = startSample; j < endSample; j++) {
        sum += Math.abs(channelData[j]);
      }

      // Store average value (normalized 0-255 for consistency with analyser output)
      staticWaveformData[i] = (sum / samplesPerBar) * 255 * sensitivity;
    }

    // Draw the static waveform
    drawStaticWaveform();
  } catch (error) {
    console.error("Error analyzing audio:", error);

    // Fallback to simple waveform if analysis fails
    if (!staticWaveformData) {
      // Create a simple default waveform if we can't analyze
      staticWaveformData = new Array(barCount).fill(0).map(
        () =>
          // Random values between 10 and 50 to show a minimal waveform
          Math.random() * 40 + 10,
      );
      drawStaticWaveform();
    }
  }
}

// Draw the static waveform
function drawStaticWaveform() {
  if (!staticWaveformData) return;

  resizeCanvas();

  // Clear the canvas
  ctx.fillStyle = bgColorPicker.value;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Calculate bar width based on canvas width and bar count
  const usableWidth = canvas.width - barSpacing * (barCount - 1);
  const barWidth = usableWidth / barCount;

  // Center line is in the middle of the canvas height
  const centerY = canvas.height / 2;

  // Draw bars
  for (let i = 0; i < barCount; i++) {
    // Apply sensitivity factor to bar height
    const barHeight = (staticWaveformData[i] / 255) * (canvas.height / 2);

    const x = i * (barWidth + barSpacing);

    // Calculate progress position
    let progressPosition = 0;
    if (
      audioElement &&
      !isNaN(audioElement.duration) &&
      audioElement.duration > 0
    ) {
      progressPosition =
        (audioElement.currentTime / audioElement.duration) * canvas.width;
    }

    // Determine if this bar is in the played section
    const isPlayed = x <= progressPosition;

    // Set color based on whether this part has been played
    ctx.fillStyle = isPlayed ? progressColorPicker.value : barColorPicker.value;

    // Draw bar extending upward from center
    ctx.fillRect(x, centerY - barHeight, barWidth, barHeight);

    // Draw bar extending downward from center
    ctx.fillRect(x, centerY, barWidth, barHeight);
  }
}

// Draw visualization during playback
function drawVisualization() {
  if (!audioContext || !analyser) return;

  animationId = requestAnimationFrame(drawVisualization);
  resizeCanvas();

  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  // Get frequency data from the audio - this is what makes the visualization dynamic
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

  // Use real-time frequency data for the visualization during playback
  drawLiveVisualization(
    dataArray,
    barWidth,
    sensitivityFactor,
    progressPosition,
  );
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
    const dataIndex = Math.min(i * step, bufferLength - 1);

    // Make sure we have a valid value
    let value = dataArray[dataIndex];
    if (value === undefined || isNaN(value)) {
      value = 0;
    }

    // Apply sensitivity factor to bar height - ensure we have visible bars
    const barHeight = Math.max(
      (value / 255) * (canvas.height / 2) * sensitivityFactor,
      1,
    );

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
    // Redraw static waveform with current progress
    drawStaticWaveform();
  } else {
    // Make sure we have analyzed audio data before playing
    if (!staticWaveformData && audioElement.duration > 0) {
      analyzeAudio().then(() => {
        audioElement.play();
        playBtn.textContent = "❚❚";
        drawVisualization();
      });
    } else {
      audioElement.play();
      playBtn.textContent = "❚❚";
      drawVisualization();
    }
  }

  isPlaying = !isPlaying;
}

// Load audio file
async function loadAudioFile(file) {
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

  // Wait for metadata to load
  await new Promise((resolve) => {
    audioElement.onloadedmetadata = function () {
      updateTimeDisplays();
      resolve();
    };
  });

  // Pre-analyze the audio to generate static waveform
  await analyzeAudio();
}

// Update settings
function updateSettings() {
  barSpacing = parseInt(barSpacingInput.value);

  // Redraw the static waveform if not playing
  if (!isPlaying && staticWaveformData) {
    drawStaticWaveform();
  }
}

// Event Listeners
playBtn.addEventListener("click", togglePlayback);

uploadBtn.addEventListener("click", function () {
  audioUpload.click();
});

audioUpload.addEventListener("change", async function (e) {
  if (e.target.files[0]) {
    initAudio();
    await loadAudioFile(e.target.files[0]);
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

    // Update the visualization
    if (isPlaying) {
      // If playing, the animation frame will handle it
    } else {
      // If paused, redraw static waveform with new position
      updateTimeDisplays();
      drawStaticWaveform();
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

// Initialize audio context and canvas when document is loaded
document.addEventListener("DOMContentLoaded", async function () {
  // Initialize canvas
  resizeCanvas();

  // Initialize audio
  initAudio();

  // Preload with your audio file - use fetch to handle it as a real URL
  audioElement = new Audio();
  audioElement.src = "AF_BullFight_Mockup_Master.wav";
  audioElement.crossOrigin = "anonymous";

  // Debug audio loading
  console.log("Attempting to load:", audioElement.src);

  audioElement.addEventListener("error", function (e) {
    console.error("Error loading audio:", e);
  });

  audioElement.addEventListener("loadedmetadata", async function () {
    updateTimeDisplays();
    // Pre-analyze audio to show waveform before playback
    try {
      await analyzeAudio();
    } catch (err) {
      console.error("Error analyzing audio:", err);
      // Show a message to the user suggesting to upload a file if preload fails
      document.querySelector(".song-title").textContent =
        "Upload an audio file";
      document.querySelector(".song-artist").textContent = "No audio loaded";
    }
  });

  // If we already have an audio context, reconnect it to the new audio element
  if (audioContext) {
    try {
      audioSource = audioContext.createMediaElementSource(audioElement);
      audioSource.connect(analyser);
      analyser.connect(audioContext.destination);
    } catch (err) {
      console.error("Error reconnecting audio:", err);
    }
  }
});

// Initialize canvas and handle resizing
resizeCanvas();
window.addEventListener("resize", function () {
  resizeCanvas();
  // Redraw static waveform if not playing
  if (!isPlaying && staticWaveformData) {
    drawStaticWaveform();
  }
});
