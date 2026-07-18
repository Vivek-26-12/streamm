import React, { useRef, useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { mediaApi, getAuthenticatedMediaUrl } from '../api/client.js';
import { 
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, 
  ChevronLeft, RotateCcw, FastForward, Settings, Loader2, Info
} from 'lucide-react';

export default function PlayerPage() {
  const { id } = useParams(); // base64url path ID
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const initialStart = parseFloat(searchParams.get('start')) || 0;
  const initialSubId = searchParams.get('subId') || '';

  const videoRef = useRef(null);
  const containerRef = useRef(null);

  // Player UI State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(initialStart);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isControlsVisible, setIsControlsVisible] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Custom transcode tracking
  const [streamOffset, setStreamOffset] = useState(initialStart);
  const [playMode, setPlayMode] = useState('direct');

  // Fetch movie details on-the-fly
  const { data: movie, isLoading: loadingDetails } = useQuery({
    queryKey: ['movie-player', id],
    queryFn: () => mediaApi.getMovie(id).then(res => res.data),
  });

  // Dynamic capabilities check & stream URL generation
  const getStreamUrl = (offset) => {
    const supportsHEVC = document.createElement('video').canPlayType('video/mp4; codecs="hvc1"') !== '';
    const videoCapabilities = ['h264'];
    if (supportsHEVC) videoCapabilities.push('hevc');

    const baseStreamPath = `/api/movie/${id}/stream`;
    const params = new URLSearchParams({
      start: offset.toString(),
      browser_video: videoCapabilities.join(','),
      browser_audio: 'aac,mp3',
      browser_containers: 'mp4'
    });

    return getAuthenticatedMediaUrl(`${baseStreamPath}?${params.toString()}`);
  };

  // Determine playMode when metadata loads
  useEffect(() => {
    if (!movie) return;

    const hasH264 = movie.video_codec === 'h264';
    const hasAAC = ['aac', 'mp3'].includes(movie.audio_codec);
    const hasMP4 = movie.container.includes('mp4');

    if (hasH264 && hasAAC && hasMP4) {
      setPlayMode('direct');
    } else if (hasH264 && hasAAC) {
      setPlayMode('remux');
    } else {
      setPlayMode('transcode');
    }
  }, [movie]);

  // Load stream source initially
  useEffect(() => {
    if (!movie || !videoRef.current) return;
    
    setIsLoading(true);
    setErrorMsg('');
    
    videoRef.current.src = getStreamUrl(streamOffset);
    videoRef.current.load();
  }, [movie]);

  // 3. Local progress tracking sync every 5 seconds
  useEffect(() => {
    if (!isPlaying || !movie) return;

    const interval = setInterval(() => {
      if (!videoRef.current) return;
      const absoluteCurrentTime = streamOffset + videoRef.current.currentTime;
      saveLocalProgress(absoluteCurrentTime);
    }, 5000);

    return () => clearInterval(interval);
  }, [isPlaying, streamOffset, movie, id]);

  // Save final progress on unmount/exit
  useEffect(() => {
    return () => {
      if (videoRef.current && movie) {
        const absoluteCurrentTime = streamOffset + videoRef.current.currentTime;
        saveLocalProgress(absoluteCurrentTime);
      }
    };
  }, [id, movie, streamOffset]);

  const saveLocalProgress = (position) => {
    if (!movie) return;
    try {
      const progressData = JSON.parse(localStorage.getItem('streamm_progress') || '{}');
      const completion = (position / movie.duration) * 100;
      
      progressData[id] = {
        id,
        title: movie.title,
        container: movie.container,
        resolution: movie.resolution,
        position,
        duration: movie.duration,
        completion_percentage: completion,
        last_watched: new Date().toISOString()
      };

      localStorage.setItem('streamm_progress', JSON.stringify(progressData));
    } catch (e) {
      console.error('Failed to save progress locally:', e);
    }
  };

  // Controls overlay auto-fade
  useEffect(() => {
    let timeout;
    const handleMouseMove = () => {
      setIsControlsVisible(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (isPlaying) {
          setIsControlsVisible(false);
          setShowSpeedMenu(false);
        }
      }, 3000);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(timeout);
    };
  }, [isPlaying]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!videoRef.current) return;
      
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleSkip(10);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handleSkip(-10);
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        adjustVolume(0.1);
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        adjustVolume(-0.1);
      } else if (e.code === 'KeyF') {
        e.preventDefault();
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, playMode, streamOffset, duration]);

  // Player event controls
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(err => {
          console.error('Play request failed:', err);
          setErrorMsg('Failed to play. Codec incompatibilities may have caused stream termination.');
        });
    }
  };

  const handleSkip = (seconds) => {
    if (!videoRef.current) return;
    const currentAbsTime = streamOffset + videoRef.current.currentTime;
    let newAbsTime = currentAbsTime + seconds;
    
    const totalDuration = movie?.duration || duration;
    newAbsTime = Math.max(0, Math.min(newAbsTime, totalDuration));

    handleSeekTo(newAbsTime);
  };

  const handleSeekTo = (absoluteTime) => {
    if (!videoRef.current) return;

    if (playMode === 'direct') {
      videoRef.current.currentTime = absoluteTime;
      setCurrentTime(absoluteTime);
    } else {
      // Seek transcode via dynamic segment restart
      setIsLoading(true);
      setStreamOffset(absoluteTime);
      setCurrentTime(absoluteTime);
      
      // Load and play synchronously to bypass iOS Safari autoplay blocking
      const newUrl = getStreamUrl(absoluteTime);
      videoRef.current.src = newUrl;
      videoRef.current.load();
      videoRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(e => {
          console.log('Synchronous play blocked, fallback to play state:', e.message);
          setIsPlaying(false);
        });
    }
  };

  const adjustVolume = (delta) => {
    if (!videoRef.current) return;
    const newVol = Math.max(0, Math.min(1, volume + delta));
    setVolume(newVol);
    videoRef.current.volume = newVol;
    setIsMuted(newVol === 0);
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
    }
    setIsMuted(val === 0);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    videoRef.current.muted = nextMute;
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(err => console.error(err));
    } else {
      document.exitFullscreen()
        .then(() => setIsFullscreen(false));
    }
  };

  const handleSpeedChange = (speed) => {
    setPlaybackSpeed(speed);
    setShowSpeedMenu(false);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const absoluteCurrent = streamOffset + videoRef.current.currentTime;
    setCurrentTime(absoluteCurrent);
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    if (playMode === 'direct') {
      setDuration(videoRef.current.duration);
    } else if (movie) {
      setDuration(movie.duration);
    }
    setIsLoading(false);
  };

  const formatTime = (secs) => {
    if (isNaN(secs)) return '00:00';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);

    const mStr = m < 10 ? `0${m}` : m;
    const sStr = s < 10 ? `0${s}` : s;

    if (h > 0) {
      return `${h}:${mStr}:${sStr}`;
    }
    return `${mStr}:${sStr}`;
  };

  const totalDuration = movie?.duration || duration;

  if (loadingDetails) {
    return (
      <div className="min-h-screen bg-black text-slate-400 flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-brand-500 mb-4" />
        <span>Running dynamic format probe...</span>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="relative w-screen h-screen bg-black overflow-hidden flex items-center justify-center select-none"
      style={{ cursor: isControlsVisible ? 'default' : 'none' }}
    >
      <video
        ref={videoRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onWaiting={() => setIsLoading(true)}
        onPlaying={() => {
          setIsLoading(false);
          setIsPlaying(true);
        }}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onError={() => {
          setIsLoading(false);
          setErrorMsg('Error playing movie stream. Transcoder error or file access issue.');
        }}
        className="w-full h-full max-h-screen max-w-full"
        onClick={togglePlay}
        playsInline
        crossOrigin="anonymous"
      >
        {initialSubId && movie && (
          <track
            src={getAuthenticatedMediaUrl(`/api/movie/${id}/subtitle?subId=${initialSubId}`)}
            kind="subtitles"
            srcLang="en"
            label="Selected Subtitles"
            default
          />
        )}
      </video>

      {/* Loading overlay spinner */}
      {isLoading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/30 pointer-events-none">
          <Loader2 className="w-16 h-16 animate-spin text-brand-500" />
        </div>
      )}

      {/* Error Banner */}
      {errorMsg && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 glass-panel border-red-500/30 p-5 rounded-2xl flex flex-col items-center max-w-md text-center text-red-400">
          <Info className="w-8 h-8 text-red-500 mb-2" />
          <p className="font-semibold">{errorMsg}</p>
          <button 
            onClick={() => navigate('/')}
            className="mt-4 px-4 py-1.5 bg-red-950/40 border border-red-900/30 rounded-lg text-xs hover:bg-red-950 transition"
          >
            Return to Dashboard
          </button>
        </div>
      )}

      {/* CUSTOM OVERLAY CONTROLS */}
      <div 
        className={`absolute inset-0 z-10 flex flex-col justify-between bg-gradient-to-t from-black/80 via-transparent to-black/75 transition-opacity duration-300 ${
          isControlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Top Header bar */}
        <div className="flex items-center justify-between p-6">
          <button 
            onClick={() => navigate('/')}
            className="flex items-center space-x-2 text-slate-400 hover:text-white transition"
          >
            <ChevronLeft className="w-6 h-6" />
            <span className="font-bold text-sm">Dashboard</span>
          </button>

          {movie && (
            <div className="text-center">
              <h1 className="text-base font-extrabold text-white truncate max-w-[280px] sm:max-w-md">{movie.title}</h1>
              <span className="text-[10px] text-brand-300 font-bold uppercase tracking-wider">
                {playMode === 'direct' ? 'Direct Play' : playMode === 'remux' ? 'Remux Stream' : 'Transcoding (h264)'}
              </span>
            </div>
          )}

          <div className="w-20" />
        </div>

        {/* Big play button in center */}
        <div className="flex-1 flex items-center justify-center">
          {!isPlaying && !isLoading && !errorMsg && (
            <button 
              onClick={togglePlay}
              className="w-20 h-20 bg-slate-900/80 hover:bg-brand-500 text-white rounded-full flex items-center justify-center transition border border-slate-700/50 hover:border-brand-400 shadow-glow-brand"
            >
              <Play className="w-8 h-8 fill-white ml-1.5" />
            </button>
          )}
        </div>

        {/* Bottom controls bar */}
        <div className="p-6 space-y-4">
          
          {/* Progress Seek Bar */}
          <div className="flex items-center space-x-3 text-xs">
            <span className="text-slate-300 font-medium">{formatTime(currentTime)}</span>
            
            <input
              type="range"
              min={0}
              max={totalDuration || 100}
              value={currentTime}
              onChange={(e) => handleSeekTo(parseFloat(e.target.value))}
              className="flex-1 h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-brand-500"
              style={{
                background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${(currentTime / (totalDuration || 100)) * 100}%, #1e293b ${(currentTime / (totalDuration || 100)) * 100}%, #1e293b 100%)`
              }}
            />
            
            <span className="text-slate-400">{formatTime(totalDuration)}</span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-5">
              <button onClick={togglePlay} className="text-slate-300 hover:text-white transition">
                {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white" />}
              </button>

              <button onClick={() => handleSkip(-10)} className="text-slate-400 hover:text-white transition">
                <RotateCcw className="w-4 h-4" />
              </button>
              <button onClick={() => handleSkip(10)} className="text-slate-400 hover:text-white transition">
                <FastForward className="w-4 h-4" />
              </button>

              <div className="flex items-center space-x-2 group/volume">
                <button onClick={toggleMute} className="text-slate-400 hover:text-white transition">
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-0 group-hover/volume:w-20 transition-all duration-300 h-1 bg-slate-800 rounded-full appearance-none cursor-pointer accent-white"
                />
              </div>
            </div>

            <div className="flex items-center space-x-5">
              <div className="relative">
                <button 
                  onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                  className="flex items-center space-x-1 text-slate-400 hover:text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-slate-900 border border-transparent hover:border-slate-800 transition"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>{playbackSpeed}x</span>
                </button>

                {showSpeedMenu && (
                  <div className="absolute bottom-10 right-0 glass-panel border-slate-850 p-1.5 rounded-xl shadow-xl w-24 space-y-0.5">
                    {[0.5, 1, 1.25, 1.5, 2].map(speed => (
                      <button
                        key={speed}
                        onClick={() => handleSpeedChange(speed)}
                        className={`w-full text-left text-xs px-2.5 py-1.5 rounded-lg hover:bg-brand-500 hover:text-white transition ${
                          playbackSpeed === speed ? 'bg-brand-500/20 text-brand-300 font-bold' : 'text-slate-300'
                        }`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button onClick={toggleFullscreen} className="text-slate-400 hover:text-white transition">
                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
