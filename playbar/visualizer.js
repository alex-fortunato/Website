// Audio context and analyzer setup
let audioContext;
let analyser;
let audioSource;
let audioBuffer;
let audioElement;
let isPlaying = false;
let animationId;
let barCount = 250; // Fixed at 200 as requested
let barSpacing = 1;
let sensitivity = 12; // Now adjustable with the slider
let minBarHeight = 0.5; // Minimum bar height to ensure visibility
let staticWaveformData = null; // Store the pre-analyzed waveform data

let previousHeights = new Array(barCount).fill(0);


// Constants for the visualization layout
// const WAVEFORM_START_X = 250; // Fixed value from CSS (album art + play button + margins)
function getWaveformStartX() {
 const art = document.querySelector(".album-art");
 const button = document.querySelector(".play-button");

 const artW = art?.offsetWidth || 150;
 const btnW = button?.offsetWidth || 10;
 const margin = -20;

 const canvasPadding = parseFloat(getComputedStyle(canvas).paddingLeft) || 0;
 return artW + btnW + margin + canvasPadding;
}

function updateTimeLabelPosition() {
  const waveformStart = getWaveformStartX();
  const waveformWidth = canvas.width - waveformStart;
  const totalTimeX = waveformStart + waveformWidth + 8;

  document.documentElement.style.setProperty('--waveform-end', `${totalTimeX}px`);
}
// Canvas setup
const canvas = document.getElementById("waveformCanvas");
const ctx = canvas.getContext("2d");
const currentTimeDisplay = document.getElementById("currentTime");
const totalTimeDisplay = document.getElementById("totalTime");

// Buttons and controls
const playBtn = document.getElementById("playBtn");
const uploadBtn = document.getElementById("uploadBtn");
const audioUpload = document.getElementById("audioUpload");


// Customization options
const barColorPicker = document.getElementById("barColor");
const progressColorPicker = document.getElementById("progressColor");
const barSpacingInput = document.getElementById("barSpacing");
const sensitivityControl = document.getElementById("sensitivityControl");
const sensitivityValue = document.getElementById("sensitivityValue");
const minHeightControl = document.getElementById("minHeightControl");
const minHeightValue = document.getElementById("minHeightValue");

// Set default colors for dark theme
barColorPicker.value = "#FF0000"; // Red for waveform
progressColorPicker.value = "#FFFFFF"; // White for progress

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

// Always tap the raw audio into analyser
    audioSource.connect(analyser);
    analyser.connect(audioContext.destination);
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
  document.documentElement.style.setProperty('--waveform-left', `${getWaveformStartX()}px`);
  updateTimeLabelPosition();
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
      staticWaveformData[i] = (sum / samplesPerBar) * 255;
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

  // Clear the canvas with transparent background
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Use the fixed starting X position for the waveform
  // const paddingLeft = WAVEFORM_START_X;
  const paddingLeft = getWaveformStartX();

  // Calculate the actual usable width for the waveform
  const totalCanvasWidth = canvas.width;
  const usableWidth = totalCanvasWidth - paddingLeft;

  // Calculate bar width based on usable width
  const totalBarSpace = barSpacing * (barCount - 1);
  const barWidth = (usableWidth - totalBarSpace) / barCount;

  // Center line is in the middle of the canvas height
  const centerY = canvas.height / 2;

  // Draw bars
  for (let i = 0; i < barCount; i++) {
    // Normalize raw static data (0–255 → 0–1)
    const normalized = staticWaveformData[i] / 255;

    // Apply your sensitivity slider, but cap at 1
    const boosted = Math.min(normalized * (sensitivity / 5), 1);

    // Scale into 45% of full canvas height
    const rawHeight = boosted * (canvas.height * 0.45);

    // Clamp between your minBarHeight and half‐canvas
    const barHeight = Math.min(
        Math.max(rawHeight, minBarHeight),
        canvas.height / 2
    );

    // Calculate X position
    const x = paddingLeft + i * (barWidth + barSpacing);

    // Compute progress for coloring
    let progressPosition = 0;
    if (audioElement && !isNaN(audioElement.duration)) {
      progressPosition = paddingLeft
          + (audioElement.currentTime / audioElement.duration) * usableWidth;
    }
    const isPlayed = x <= progressPosition;
    ctx.fillStyle = isPlayed
        ? progressColorPicker.value
        : barColorPicker.value;
    // Save the default state
    ctx.save();

// Configure  glow
    ctx.shadowColor  = isPlayed ? progressColorPicker.value : barColorPicker.value;
    ctx.shadowBlur   = 5;             // how “wide” the glow spreads
    ctx.shadowOffsetX = 0;             // keep shadow centered
    ctx.shadowOffsetY = 0;
    // Draw up & down from center
    ctx.fillRect(x, centerY - barHeight, barWidth, barHeight);
    ctx.fillRect(x, centerY,           barWidth, barHeight);
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

  // Clear the canvas with transparent background
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Update time displays
  updateTimeDisplays();

  // Use the fixed starting X position for the waveform
  // const paddingLeft = WAVEFORM_START_X;
  const paddingLeft = getWaveformStartX();
  // Calculate the actual usable width for the waveform
  const totalCanvasWidth = canvas.width;
  const usableWidth = totalCanvasWidth - paddingLeft;

  // Calculate bar width based on usable width
  const totalBarSpace = barSpacing * (barCount - 1);
  const barWidth = (usableWidth - totalBarSpace) / barCount;

  // Get the sensitivity factor
  const sensitivityFactor = sensitivity / 5;

  // Calculate the progress position
  let progressPosition = 0;
  if (
      audioElement &&
      !isNaN(audioElement.duration) &&
      audioElement.duration > 0
  ) {
    progressPosition = paddingLeft + (audioElement.currentTime / audioElement.duration) * usableWidth;
  }

  // Use real-time frequency data for the visualization during playback
  drawLiveVisualization(
      dataArray,
      barWidth,
      sensitivityFactor,
      progressPosition
  );
}

// Draw live visualization during playback
function drawLiveVisualization(dataArray, barWidth, sensitivityFactor, progressPosition) {
  const easingUp = 1.5;
  const easingDown = 1.5;
  const bufferLength = analyser.frequencyBinCount;
  const barColor      = barColorPicker.value;
  const progressColor = progressColorPicker.value;

  const paddingLeft = getWaveformStartX();
  const step        = Math.floor(bufferLength / barCount);
  const centerY     = canvas.height / 2;

  for (let i = 0; i < barCount; i++) {
    // … your existing frequency → boosted → easedHeight logic …
    const normIndex    = i / barCount;
    const logIndex     = Math.floor(Math.pow(normIndex, 2) * (bufferLength - 1));
    const dataIndex    = Math.min(logIndex, bufferLength - 1);
    let   value        = dataArray[dataIndex] || 0;
    const lowEndCut    = 1 - Math.pow(1 - normIndex, 1.5);
    value            *= lowEndCut;
    const normalized   = value / 255;
    const boosted      = Math.min(normalized * sensitivityFactor, 1);
    const targetHeight = boosted * (canvas.height * 0.45);

    const currentHeight = previousHeights[i] || 0;
    const easeFactor    = targetHeight > currentHeight ? easingUp : easingDown;
    const easedHeight   = currentHeight + (targetHeight - currentHeight) * easeFactor;
    previousHeights[i]  = easedHeight;

    const barHeight = Math.min(Math.max(easedHeight, minBarHeight), canvas.height / 2);
    const x         = paddingLeft + i * (barWidth + barSpacing);
    const isPlayed  = x <= progressPosition;

    // 1) Decide fill & glow color
    const fillCol    = isPlayed ? progressColor : barColor;

    // 2) Save & configure shadow
    ctx.save();
    ctx.fillStyle   = fillCol;
    ctx.shadowColor = fillCol;
    ctx.shadowBlur  = 5;    // glow radius, adjust as desired
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // 3) Draw bar halves
    ctx.fillRect(x, centerY - barHeight, barWidth, barHeight);
    ctx.fillRect(x, centerY,            barWidth, barHeight);

    // 4) Restore to clear shadow settings
    ctx.restore();
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

  // Get references to the icon images
  const playIcon = document.getElementById("playIcon");
  const pauseIcon = document.getElementById("pauseIcon");

  if (isPlaying) {
    audioElement.pause();
   // Show play icon, hide pause icon
   playIcon.style.display = "block";
   pauseIcon.style.display = "none";
    cancelAnimationFrame(animationId);
    // Redraw static waveform with current progress
    drawStaticWaveform();
  } else {
    // Make sure we have analyzed audio data before playing
    if (!staticWaveformData && audioElement.duration > 0) {
      analyzeAudio().then(() => {
        audioElement.play();
        // Show pause icon, hide play icon
        playIcon.style.display = "none";
        pauseIcon.style.display = "block";
        drawVisualization();
      });
    } else {
      audioElement.play();
      // Show pause icon, hide play icon
      playIcon.style.display = "none";
      pauseIcon.style.display = "block";
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
    // 1) Create the MediaElementSource
    audioSource = audioContext.createMediaElementSource(audioElement);

// 2) Tap raw audio into the analyser (for visuals)
    audioSource.connect(analyser);






  }

  // Reset state
  isPlaying = false;
  const playIcon = document.getElementById("playIcon");
  const pauseIcon = document.getElementById("pauseIcon");
  playIcon.style.display = "block";
  pauseIcon.style.display = "none";

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
  // const clickX = event.clientX - rect.left;
  const styles = getComputedStyle(canvas);
  const paddingLeft = parseInt(styles.paddingLeft);
  const clickX = event.clientX - rect.left - paddingLeft;

  // Only process the click if it's in the waveform area (after the fixed position)
  if (clickX < getWaveformStartX()) {
    console.log("Click ignored - in album art/play button area");
    return;
  }

  // Calculate the percentage based on the position within the actual waveform area
  // The actual waveform width is the total canvas width minus the starting position

  const paddingRight = parseFloat(styles.paddingRight) || 0;
  const waveformStart = getWaveformStartX();
  const usableWidth = canvas.width - waveformStart - paddingRight;
  const adjustedClickX = clickX - waveformStart;

  const clickPercent = adjustedClickX / usableWidth;

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
barSpacingInput.addEventListener("input", updateSettings);

// Add event listener for sensitivity control
sensitivityControl.addEventListener("input", function() {
  sensitivity = parseFloat(sensitivityControl.value);
  sensitivityValue.textContent = sensitivity;

  // Redraw static waveform if not playing
  if (!isPlaying && staticWaveformData) {
    drawStaticWaveform();
  }
});

// Add event listener for minimum height control
minHeightControl.addEventListener("input", function() {
  minBarHeight = parseFloat(minHeightControl.value);
  minHeightValue.textContent = minBarHeight;

  // Redraw static waveform if not playing
  if (!isPlaying && staticWaveformData) {
    drawStaticWaveform();
  }
});



// Initialize audio context when document is loaded
document.addEventListener("DOMContentLoaded", async function () {
  // Initialize canvas
  resizeCanvas();

  // Initialize audio
  initAudio();

  const playIcon = document.getElementById("playIcon");
  const pauseIcon = document.getElementById("pauseIcon");
  if(isPlaying) {
    playIcon.style.display = "none";
    pauseIcon.style.display = "block";
  } else {
    playIcon.style.display = "block";
    pauseIcon.style.display = "none";
  }
  // Preload with your audio file
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