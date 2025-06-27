// Audio Player Manager
class AudioPlayerManager {
    constructor() {
        this.players = new Map(); // Store all player instances
        this.currentlyPlaying = null; // Track which player is currently playing
        this.audioContext = null; // Shared audio context
        this.analyser = null; // Shared analyser

        // Initialize shared audio context
        this.initAudioContext();

        // Configuration options
        this.barCount = 250;
        this.barSpacing = 0;
        this.sensitivity = 12;
        this.minBarHeight = 0.5;
        this.barColor = "rgba(255,0,0,0.84)";
        this.progressColor = "#FFFFFF";

        // Initialize the players
        this.initPlayers();

        // Handle window resize
        window.addEventListener("resize", () => {
            this.players.forEach(player => {
                player.resizeCanvas();
                player.updateTimeInfoPositions();
                if (!player.isPlaying && player.staticWaveformData) {
                    player.drawStaticWaveform();
                }
            });
        });
    }

    // Initialize shared audio context
    initAudioContext() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 1024;
    }

    // Initialize all player instances on the page
    initPlayers() {
        const playerContainers = document.querySelectorAll('.player-container');

        playerContainers.forEach((container, index) => {
            const playerId = container.dataset.playerId || `player${index + 1}`;
            const songData = {
                id: playerId,
                title: container.querySelector('.song-title').textContent.trim(),
                audio: this.getSongUrlById(playerId),
                albumArt: container.querySelector('.album-art img').src
            };

            // Create a new player
            const player = new AudioPlayer(this, container, songData);
            this.players.set(playerId, player);
        });
    }

    // Get song URL based on player ID - customize this for your audio sources
    getSongUrlById(playerId) {
        const audioSources = {
            player1: "https://dl.dropboxusercontent.com/scl/fi/vzk3mg3iaftu7mv8yf6z1/AF_BullFight_Mockup_Master.mp3?rlkey=4dmiwmjkkhv71daw3xbv6yigp&dl=0",
            player2: "https://dl.dropboxusercontent.com/scl/fi/p7xq8za1310gilf6t6fml/Outlandish_1m03_Website.wav?rlkey=eo37maygadlcpsc06mv9vcmjp&dl=0",
            player3: "https://dl.dropboxusercontent.com/scl/fi/4gscl4bx3nguexcm575sc/TheKiss_WithMIDI_V2.wav?rlkey=ph0e9dvkk8r68bmq746ow710o&dl=0",
        };

        return audioSources[playerId] || "";
    }

    // Pause all players except the one that was just activated
    pauseAllExcept(exceptPlayerId) {
        this.players.forEach((player, playerId) => {
            if (playerId !== exceptPlayerId && player.isPlaying) {
                player.pause();
            }
        });

        this.currentlyPlaying = exceptPlayerId;
    }
}

// Individual Audio Player
class AudioPlayer {
    constructor(manager, container, songData) {
        this.manager = manager;
        this.container = container;
        this.songData = songData;

        // DOM elements
        this.canvas = container.querySelector('.waveform-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.playButton = container.querySelector('.play-button');
        this.playIcon = container.querySelector('.play-icon');
        this.pauseIcon = container.querySelector('.pause-icon');
        this.currentTimeDisplay = container.querySelector('.current-time');
        this.totalTimeDisplay = container.querySelector('.total-time');

        // State variables
        this.audioElement = null;
        this.audioSource = null;
        this.isPlaying = false;
        this.animationId = null;
        this.staticWaveformData = null;
        this.previousHeights = new Array(manager.barCount).fill(0);

        // Loading animation variables
        this.isLoading = true;
        this.loadingAnimationId = null;
        this.loadingProgress = 0;
        this.opacity = 0.2;
        this.fadeDirection = 1; // 1 for fade in, -1 for fade out

        // Initialize the player
        this.initAudio();
        this.setupEventListeners();
        this.resizeCanvas();

        // Start loading animation immediately
        this.startLoadingAnimation();
    }

    // Get the font style from the parent container
    getInheritedFont() {
        // Try to get the computed style from the container
        const containerStyle = window.getComputedStyle(this.container);

        // Extract the font properties
        const fontFamily = containerStyle.fontFamily || '"Cormorant Garamond", serif';
        const fontSize = '14px'; // You can set a default size or get it from container

        // Return complete font string
        return `${fontSize} ${fontFamily}`;
    }

    // Initialize audio element
    initAudio() {
        this.audioElement = new Audio();
        this.audioElement.crossOrigin = "anonymous";
        this.audioElement.src = this.songData.audio;

        // Add ended event listener
        this.audioElement.addEventListener("ended", () => this.handleAudioEnd());

        // Connect to audio context when metadata is loaded
        this.audioElement.addEventListener("loadedmetadata", async () => {
            this.updateTimeDisplays();
            try {
                await this.analyzeAudio();
            } catch (err) {
                console.error("Error analyzing audio:", err);
                this.stopLoadingAnimation();
                this.showErrorMessage("Failed to analyze audio");
            }
        });

        // Handle loading errors
        this.audioElement.addEventListener("error", (e) => {
            console.error("Error loading audio:", e);
            this.stopLoadingAnimation();
            this.showErrorMessage("Error loading audio");
        });
    }

    // Show error message on canvas
    showErrorMessage(message) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.font = this.getInheritedFont(16);
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
        this.ctx.fillText(message, this.canvas.width/2, this.canvas.height/2);
    }

    // Loading animation functions
    startLoadingAnimation() {
        this.isLoading = true;
        this.loadingProgress = 0;
        this.opacity = 0.2;
        this.fadeDirection = 1;

        if (this.loadingAnimationId) {
            cancelAnimationFrame(this.loadingAnimationId);
        }

        // Start with a clean canvas
        this.resizeCanvas();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Begin the loading animation loop
        this.animateLoading();
    }

    stopLoadingAnimation() {
        this.isLoading = false;

        if (this.loadingAnimationId) {
            cancelAnimationFrame(this.loadingAnimationId);
            this.loadingAnimationId = null;
        }
    }

    animateLoading() {
        if (!this.isLoading) return;

        this.loadingAnimationId = requestAnimationFrame(() => this.animateLoading());

        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Update opacity for fade effect
        this.opacity += 0.03 * this.fadeDirection;

        // Reverse fade direction at min/max opacity
        if (this.opacity >= 0.9) {
            this.opacity = 0.9;
            this.fadeDirection = -1;
        } else if (this.opacity <= 0.2) {
            this.opacity = 0.2;
            this.fadeDirection = 1;
        }

        // Draw the loading text with fade animation
        this.drawFadeText();

        // Increment progress if not being set externally
        if (this.loadingProgress < 0.99) {
            this.loadingProgress += 0.003;
        }
    }

    // Draw text with fade animation
    drawFadeText() {
        const text = "Loading Audio";

        // Position text in the middle of the canvas
        const paddingLeft = this.getWaveformStartX();
        const centerX = paddingLeft + (this.canvas.width - paddingLeft) / 2;
        const centerY = this.canvas.height / 2;

        // Configure text style
        this.ctx.font = this.getInheritedFont(11);
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        // Set text color with current opacity
        this.ctx.fillStyle = `rgba(255, 0, 0, ${this.opacity})`;

        // Draw the text
        this.ctx.fillText(text, centerX, centerY);
    }

    // Set up event listeners
    setupEventListeners() {
        // Play/pause button
        this.playButton.addEventListener('click', () => this.togglePlayback());

        // Canvas click for scrubbing
        this.canvas.addEventListener('click', (event) => this.handleCanvasClick(event));

        // Hover effect
        this.canvas.addEventListener('mousemove', () => {
            this.canvas.style.cursor = 'pointer';
        });
    }

    // Toggle playback
    togglePlayback() {
        if (!this.audioElement || !this.audioElement.src) {
            console.error("No audio source available");
            return;
        }

        if (this.manager.audioContext.state === "suspended") {
            this.manager.audioContext.resume();
        }

        if (this.isPlaying) {
            this.pause();
        } else {
            // Pause any other playing tracks
            this.manager.pauseAllExcept(this.songData.id);

            // Set up audio source if not already connected
            if (!this.audioSource) {
                this.audioSource = this.manager.audioContext.createMediaElementSource(this.audioElement);
                this.audioSource.connect(this.manager.analyser);
                this.manager.analyser.connect(this.manager.audioContext.destination);
            }

            // Play this track
            this.play();
        }
    }

    // Play the audio
    play() {
        // Make sure we have analyzed audio data
        if (!this.staticWaveformData && this.audioElement.duration > 0) {
            this.analyzeAudio().then(() => {
                this.startPlayback();
            });
        } else {
            this.startPlayback();
        }
    }

    // Start playback
    startPlayback() {
        this.audioElement.play();
        this.playIcon.style.display = "none";
        this.pauseIcon.style.display = "block";
        this.isPlaying = true;
        this.manager.currentlyPlaying = this.songData.id;
        this.drawVisualization();
    }

    // Pause the audio
    pause() {
        this.audioElement.pause();
        this.playIcon.style.display = "block";
        this.pauseIcon.style.display = "none";
        this.isPlaying = false;

        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }

        // Redraw static waveform with current progress
        this.drawStaticWaveform();
    }

    // Handle audio end
    handleAudioEnd() {
        this.isPlaying = false;
        this.playIcon.style.display = "block";
        this.pauseIcon.style.display = "none";

        // Stop the animation
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }

        // Reset the audio to beginning
        this.audioElement.currentTime = 0;

        // Update displays
        this.updateTimeDisplays();

        // Redraw static waveform
        this.drawStaticWaveform();
    }

    // Handle canvas click for scrubbing and switching players
    handleCanvasClick(event) {
        if (!this.audioElement || !this.audioElement.src) return;

        // Get click position relative to canvas
        const rect = this.canvas.getBoundingClientRect();
        const clickX = event.clientX - rect.left;

        // Get waveform start position
        const paddingLeft = this.getWaveformStartX();

        // Only process clicks in the waveform area (after padding)
        if (clickX < paddingLeft) {
            console.log("Click ignored - in album art/play button area");

            // If clicked in the non-waveform area, just toggle playback
            if (!this.isPlaying) {
                this.togglePlayback();
            }
            return;
        }

        // We're in the waveform area, so calculate the position
        const canvasScaleFactor = this.canvas.width / this.canvas.clientWidth;
        const adjustedClickX = (clickX - paddingLeft) * canvasScaleFactor;
        const usableWidth = this.canvas.width - paddingLeft;
        const clickPercent = adjustedClickX / usableWidth;
        const clampedPercent = Math.max(0, Math.min(1, clickPercent));

        // Set the audio playback position
        if (this.audioElement.duration) {
            this.audioElement.currentTime = clampedPercent * this.audioElement.duration;

            // If not already playing, start playback
            if (!this.isPlaying) {
                // This will pause other players and start this one
                this.togglePlayback();
            } else {
                // Already playing, just update displays and continue
                this.updateTimeDisplays();
            }
        }
    }

    // Get the waveform start X position
    getWaveformStartX() {
        const art = this.container.querySelector(".album-art");
        const button = this.container.querySelector(".play-button");

        const artW = art?.offsetWidth || 150;
        const btnW = button?.offsetWidth || 10;
        const margin = -20;

        const canvasPadding = parseFloat(getComputedStyle(this.canvas).paddingLeft) || 0;
        return artW + btnW + margin + canvasPadding;
    }

    // Resize canvas to match display size
    resizeCanvas() {
        const containerWidth = this.canvas.clientWidth - 60;
        const containerHeight = this.canvas.clientHeight;

        if (this.canvas.width !== containerWidth || this.canvas.height !== containerHeight) {
            this.canvas.width = containerWidth;
            this.canvas.height = containerHeight;
        }
        this.updateTimeInfoPositions();
    }

    // Update time displays
    updateTimeDisplays() {
        if (this.audioElement && !isNaN(this.audioElement.duration)) {
            this.currentTimeDisplay.textContent = this.formatTime(this.audioElement.currentTime);
            this.totalTimeDisplay.textContent = this.formatTime(this.audioElement.duration);
        }
    }

    // Format time in MM:SS
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return mins + ":" + (secs < 10 ? "0" : "") + secs;
    }

    // Update time info positions
    updateTimeInfoPositions() {
        const waveformStartX = this.getWaveformStartX();
        const currentTimeElement = this.currentTimeDisplay;
        const totalTimeElement = this.totalTimeDisplay;
        const playButton = this.playButton;
        const visualizationsContainer = this.container.querySelector(".visualization-container");

        // Get dimensions
        const playButtonRect = playButton.getBoundingClientRect();
        const containerRect = visualizationsContainer.getBoundingClientRect();
        const containerWidth = containerRect.width;

        // Set styles for better visibility
        currentTimeElement.style.backgroundColor = "transparent";
        totalTimeElement.style.backgroundColor = "transparent";
        currentTimeElement.style.color = "rgb(255,0,0)";
        totalTimeElement.style.color = "rgb(255,0,0)";

        // Calculate play button right edge relative to container
        const playButtonRightEdge = playButtonRect.right - containerRect.left;

        if (containerWidth < 600) {
            // Responsive positioning for small screens
            const verticalOffset = -60;
            const horizontalOffset = 5;

            currentTimeElement.style.left = `${playButton.offsetLeft + horizontalOffset}px`;
            currentTimeElement.style.top = `${playButton.offsetTop + playButton.offsetHeight + verticalOffset}px`;
            currentTimeElement.style.transform = "none";

            totalTimeElement.style.left = "auto";
            totalTimeElement.style.right = "5px";
            totalTimeElement.style.top = `${playButton.offsetTop + playButton.offsetHeight + verticalOffset}px`;
            totalTimeElement.style.transform = "none";
        } else {
            // Standard positioning
            const timePadding = 10;

            currentTimeElement.style.left = `${playButtonRightEdge + timePadding}px`;
            currentTimeElement.style.top = "50%";
            currentTimeElement.style.bottom = "auto";
            currentTimeElement.style.transform = "translateY(-50%)";

            totalTimeElement.style.left = "auto";
            totalTimeElement.style.right = "5px";
            totalTimeElement.style.top = "50%";
            totalTimeElement.style.transform = "translateY(-50%)";
        }
    }

    // Analyze audio to create waveform data
    async analyzeAudio() {
        if (!this.manager.audioContext || !this.audioElement.src) return;

        // Start loading animation if not already started
        this.startLoadingAnimation();

        try {
            // Create a temporary offline audio context for analysis
            const offlineCtx = new OfflineAudioContext(
                1, // Single channel for analysis
                this.audioElement.duration * this.manager.audioContext.sampleRate,
                this.manager.audioContext.sampleRate,
            );

            // Update progress to show we're starting
            this.loadingProgress = 0.1;

            // Fetch the audio file
            const response = await fetch(this.audioElement.src);

            // Update progress to show download complete
            this.loadingProgress = 0.4;

            const arrayBuffer = await response.arrayBuffer();

            // Decode the audio data
            const audioData = await offlineCtx.decodeAudioData(arrayBuffer);

            // Update progress to show decoding complete
            this.loadingProgress = 0.6;

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
            const sampleSize = this.manager.barCount;
            this.staticWaveformData = new Array(sampleSize).fill(0);

            // Process the audio in chunks
            const samplesPerBar = Math.floor(audioData.length / sampleSize);

            // Get the audio data
            const channelData = audioData.getChannelData(0);

            // Update progress for analysis phase
            this.loadingProgress = 0.8;

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
                this.staticWaveformData[i] = (sum / samplesPerBar) * 255;

                // Gradually update progress during analysis
                if (i % 50 === 0) {
                    this.loadingProgress = 0.8 + (0.2 * (i / sampleSize));
                }
            }

            // Final progress update
            this.loadingProgress = 1.0;

            // Allow the final animation state to display briefly
            await new Promise(resolve => setTimeout(resolve, 300));

            // Stop loading animation
            this.stopLoadingAnimation();

            // Draw the static waveform
            this.drawStaticWaveform();
        } catch (error) {
            console.error("Error analyzing audio:", error);

            // Stop loading animation
            this.stopLoadingAnimation();

            // Show error message
            this.showErrorMessage("Error analyzing audio");

            // Fallback to simple waveform if analysis fails
            if (!this.staticWaveformData) {
                // Create a simple default waveform
                this.staticWaveformData = new Array(this.manager.barCount).fill(0).map(
                    () => Math.random() * 40 + 10,
                );
                this.drawStaticWaveform();
            }
        }
    }

    // Draw the static waveform
    drawStaticWaveform() {
        if (!this.staticWaveformData) return;

        this.resizeCanvas();

        // Clear the canvas with transparent background
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Get the waveform start position
        const paddingLeft = this.getWaveformStartX();

        // Calculate the actual usable width for the waveform
        const totalCanvasWidth = this.canvas.width;
        const usableWidth = totalCanvasWidth - paddingLeft;

        // Calculate bar width based on usable width
        const totalBarSpace = this.manager.barSpacing * (this.manager.barCount - 1);
        const barWidth = (usableWidth - totalBarSpace) / this.manager.barCount;

        // Center line is in the middle of the canvas height
        const centerY = this.canvas.height / 2;

        // Draw bars
        for (let i = 0; i < this.manager.barCount; i++) {
            // Normalize raw static data (0–255 → 0–1)
            const normalized = this.staticWaveformData[i] / 255;

            // Apply sensitivity, but cap at 1
            const boosted = Math.min(normalized * (this.manager.sensitivity / 5), 1);

            // Scale into 45% of full canvas height
            const rawHeight = boosted * (this.canvas.height * 0.45);

            // Clamp between minBarHeight and half‐canvas
            const barHeight = Math.min(
                Math.max(rawHeight, this.manager.minBarHeight),
                this.canvas.height / 2
            );

            // Calculate X position
            const x = paddingLeft + i * (barWidth + this.manager.barSpacing);

            // Compute progress for coloring
            let progressPosition = 0;
            if (this.audioElement && !isNaN(this.audioElement.duration)) {
                progressPosition = paddingLeft
                    + (this.audioElement.currentTime / this.audioElement.duration) * usableWidth;
            }
            const isPlayed = x <= progressPosition;
            this.ctx.fillStyle = isPlayed ? this.manager.progressColor : this.manager.barColor;

            // Save the default state
            this.ctx.save();

            // Configure glow
            this.ctx.shadowColor = isPlayed ? this.manager.progressColor : this.manager.barColor;
            this.ctx.shadowBlur = 5;
            this.ctx.shadowOffsetX = 0;
            this.ctx.shadowOffsetY = 0;

            // Draw up & down from center
            this.ctx.fillRect(x, centerY - barHeight, barWidth, barHeight);
            this.ctx.fillRect(x, centerY, barWidth, barHeight);

            // Restore context
            this.ctx.restore();
        }
        this.updateTimeInfoPositions();
    }

    // Draw visualization during playback
    drawVisualization() {
        if (!this.manager.audioContext || !this.manager.analyser) return;

        this.animationId = requestAnimationFrame(() => this.drawVisualization());
        this.resizeCanvas();

        const bufferLength = this.manager.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        // Get frequency data from the audio
        this.manager.analyser.getByteFrequencyData(dataArray);

        // Clear the canvas with transparent background
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Update time displays
        this.updateTimeDisplays();

        // Use the fixed starting X position for the waveform
        const paddingLeft = this.getWaveformStartX();

        // Calculate the actual usable width for the waveform
        const totalCanvasWidth = this.canvas.width;
        const usableWidth = totalCanvasWidth - paddingLeft;

        // Calculate bar width based on usable width
        const totalBarSpace = this.manager.barSpacing * (this.manager.barCount - 1);
        const barWidth = (usableWidth - totalBarSpace) / this.manager.barCount;

        // Get the sensitivity factor
        const sensitivityFactor = this.manager.sensitivity / 5;

        // Calculate the progress position
        let progressPosition = 0;
        if (
            this.audioElement &&
            !isNaN(this.audioElement.duration) &&
            this.audioElement.duration > 0
        ) {
            progressPosition = paddingLeft + (this.audioElement.currentTime / this.audioElement.duration) * usableWidth;
        }

        this.updateTimeInfoPositions();

        // Draw the live visualization
        this.drawLiveVisualization(
            dataArray,
            barWidth,
            sensitivityFactor,
            progressPosition
        );
    }

    // Draw live visualization during playback
    drawLiveVisualization(dataArray, barWidth, sensitivityFactor, progressPosition) {
        const easingUp = 1.5;
        const easingDown = 1.5;
        const bufferLength = this.manager.analyser.frequencyBinCount;

        const paddingLeft = this.getWaveformStartX();
        const centerY = this.canvas.height / 2;

        for (let i = 0; i < this.manager.barCount; i++) {
            const normIndex = i / this.manager.barCount;
            const logIndex = Math.floor(Math.pow(normIndex, 2) * (bufferLength - 1));
            const dataIndex = Math.min(logIndex, bufferLength - 1);
            let value = dataArray[dataIndex] || 0;
            const lowEndCut = 1 - Math.pow(1 - normIndex, 1.5);
            value *= lowEndCut;
            const normalized = value / 255;
            const boosted = Math.min(normalized * sensitivityFactor, 1);
            const targetHeight = boosted * (this.canvas.height * 0.45);

            const currentHeight = this.previousHeights[i] || 0;
            const easeFactor = targetHeight > currentHeight ? easingUp : easingDown;
            const easedHeight = currentHeight + (targetHeight - currentHeight) * easeFactor;
            this.previousHeights[i] = easedHeight;

            const barHeight = Math.min(Math.max(easedHeight, this.manager.minBarHeight), this.canvas.height / 2);
            const x = paddingLeft + i * (barWidth + this.manager.barSpacing);
            const isPlayed = x <= progressPosition;

            // Decide fill & glow color
            const fillCol = isPlayed ? this.manager.progressColor : this.manager.barColor;

            // Save & configure shadow
            this.ctx.save();
            this.ctx.fillStyle = fillCol;
            this.ctx.shadowColor = fillCol;
            this.ctx.shadowBlur = 5;
            this.ctx.shadowOffsetX = 0;
            this.ctx.shadowOffsetY = 0;

            // Draw bar halves
            this.ctx.fillRect(x, centerY - barHeight, barWidth, barHeight);
            this.ctx.fillRect(x, centerY, barWidth, barHeight);

            // Restore to clear shadow settings
            this.ctx.restore();
        }
    }
}

// Initialize the player manager when the DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
    const playerManager = new AudioPlayerManager();
});