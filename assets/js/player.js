// Audio Player for BVS Radio
class AudioPlayer {
    constructor() {
        this.audio = new Audio();
        this.isPlaying = false;
        this.progressFill = document.getElementById('progressFill');
        this.currentTimeSpan = document.querySelector('.current-time');
        this.durationSpan = document.querySelector('.duration');
        this.playBtn = document.querySelector('.player-btn.play');
        this.prevBtn = document.querySelector('.player-btn.prev');
        this.nextBtn = document.querySelector('.player-btn.next');
        this.volumeBtn = document.querySelector('.volume-btn');
        this.volumeSlider = document.querySelector('.volume-slider');
        
        // Set initial volume
        this.audio.volume = 0.7;
        this.volumeSlider.value = 70;
        
        // Bind event listeners
        this.playBtn.addEventListener('click', () => this.togglePlay());
        this.prevBtn.addEventListener('click', () => this.skipBack());
        this.nextBtn.addEventListener('click', () => this.skipForward());
        this.audio.addEventListener('timeupdate', () => this.updateProgress());
        this.audio.addEventListener('loadedmetadata', () => {
            this.durationSpan.textContent = this.formatTime(this.audio.duration);
        });
        this.audio.addEventListener('ended', () => {
            // For live stream, just restart or do nothing
            this.audio.currentTime = 0;
            this.audio.play();
        });
        this.volumeBtn.addEventListener('click', () => this.toggleMute());
        this.volumeSlider.addEventListener('input', (e) => {
            this.audio.volume = e.target.value / 100;
            this.volumeBtn.classList.toggle('muted', e.target.value == 0);
        });
        
        // Initialize stream URL - REPLACE WITH ACTUAL STREAM URL
        // Using a public test stream for demonstration - REPLACE WITH YOUR ACTUAL STREAM
        this.streamUrl = 'https://stream.live.vc.bbcmedia.co.uk/bbc_radio_one'; // BBC Radio One test stream
        this.audio.src = this.streamUrl;
        
        // Start playing when ready
        this.audio.addEventListener('canplay', () => {
            this.play();
        });
    }
    
    togglePlay() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }
    
    play() {
        this.audio.play().then(() => {
            this.isPlaying = true;
            this.playBtn.innerHTML = '&#10074;&#10074;'; // Pause icon
        }).catch(e => {
            console.error('Playback failed:', e);
            alert('Unable to play stream. Please check the stream URL and try again.');
        });
    }
    
    pause() {
        this.audio.pause();
        this.isPlaying = false;
        this.playBtn.innerHTML = '&#9658;'; // Play icon
    }
    
    skipBack() {
        // For live stream, maybe restart or go to previous show
        this.audio.currentTime = Math.max(0, this.audio.currentTime - 10);
    }
    
    skipForward() {
        // For live stream, maybe skip ahead 10 seconds (not typical for live)
        this.audio.currentTime += 10;
    }
    
    updateProgress() {
        const progress = (this.audio.currentTime / this.audio.duration) * 100;
        this.progressFill.style.width = progress + '%';
        this.currentTimeSpan.textContent = this.formatTime(this.audio.currentTime);
    }
    
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }
    
    toggleMute() {
        if (this.audio.muted) {
            this.audio.muted = false;
            this.volumeBtn.classList.remove('muted');
            this.volumeSlider.value = this.audio.volume * 100;
        } else {
            this.audio.muted = true;
            this.volumeBtn.classList.add('muted');
            this.volumeSlider.value = 0;
        }
    }
}

// Initialize player when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.audioPlayer = new AudioPlayer();
});

// Expose for debugging
window.audioPlayerInstance = null;
document.addEventListener('DOMContentLoaded', () => {
    window.audioPlayerInstance = new AudioPlayer();
});