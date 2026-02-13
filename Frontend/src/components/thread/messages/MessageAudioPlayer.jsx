import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, RotateCcw } from 'lucide-react';

const MessageAudioPlayer = ({
    src,
    msgId,
    activeId,
    onPlay,
    voiceName = "Voice Message",
    voiceType = "Auto"
}) => {
    const audioRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [error, setError] = useState(false);

    // Sync with activeId (pause if another audio starts)
    useEffect(() => {
        if (activeId !== msgId && isPlaying && audioRef.current) {
            audioRef.current.pause();
            setIsPlaying(false);
        }
    }, [activeId, msgId, isPlaying]);

    // Handle Play/Pause
    const togglePlay = () => {
        if (!audioRef.current) return;

        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
            onPlay(null);
        } else {
            const playPromise = audioRef.current.play();
            if (playPromise !== undefined) {
                playPromise
                    .then(() => {
                        setIsPlaying(true);
                        onPlay(msgId);
                        setError(false);
                    })
                    .catch(e => {
                        console.error("Play failed:", e);
                        setError(true);
                    });
            }
        }
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
        }
    };

    const handleLoadedMetadata = () => {
        if (audioRef.current) {
            setDuration(audioRef.current.duration);
            setError(false);
        }
    };

    const handleEnded = () => {
        setIsPlaying(false);
        onPlay(null);
        setCurrentTime(0);
    };

    const handleError = (e) => {
        console.error("Audio error:", e);
        setError(true);
        setIsPlaying(false);
    };

    const handleSeek = (e) => {
        const newTime = parseFloat(e.target.value);
        setCurrentTime(newTime); // Optimistic update
        if (audioRef.current) {
            audioRef.current.currentTime = newTime;
        }
    };

    const formatTime = (time) => {
        if (isNaN(time)) return "0:00";
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    // Generate bars for visualizer
    const bars = Array.from({ length: 12 }, (_, i) => i);

    return (
        <div className={`mb-2 p-3 rounded-2xl border backdrop-blur-md flex flex-col gap-2 group transition-all shadow-lg ${error ? "border-red-500/50 bg-red-500/10" : "border-white/10 bg-black/40 hover:border-white/20"}`}>

            {/* Hidden Audio Element */}
            <audio
                ref={audioRef}
                src={src}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={handleEnded}
                onError={handleError}
                preload="metadata"
            />

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {/* Play/Pause Button */}
                    <button
                        onClick={togglePlay}
                        disabled={error}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isPlaying
                                ? "bg-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.6)] scale-105"
                                : error
                                    ? "bg-red-500/20 text-red-400 cursor-not-allowed"
                                    : "bg-white/10 text-white hover:bg-white/20 hover:scale-105"
                            }`}
                    >
                        {error ? (
                            <RotateCcw className="w-4 h-4" />
                        ) : isPlaying ? (
                            <Pause className="w-4 h-4 fill-current" />
                        ) : (
                            <Play className="w-4 h-4 fill-current ml-0.5" />
                        )}
                    </button>

                    {/* Info */}
                    <div className="flex flex-col">
                        <div className="text-xs font-bold text-zinc-100">
                            {error ? "Playback Error" : voiceName}
                        </div>
                        <div className={`text-[10px] flex items-center gap-1 ${error ? "text-red-400" : "text-cyan-400"}`}>
                            <Volume2 className="w-3 h-3" />
                            {error ? "Check console" : voiceType}
                        </div>
                    </div>
                </div>

                {/* Visualizer (Animated) */}
                {!error && (
                    <div className="flex items-end gap-[3px] h-8 px-2">
                        {bars.map((bar) => (
                            <div
                                key={bar}
                                className="w-1 rounded-full bg-gradient-to-t from-cyan-600 to-cyan-400"
                                style={{
                                    height: isPlaying
                                        ? `${Math.max(15, 30 + (Math.sin(Date.now() / 100 + bar) * 50))}%`
                                        : '20%',
                                    animation: isPlaying
                                        ? `equalizer ${0.5 + Math.random() * 0.5}s ease-in-out infinite alternate`
                                        : 'none',
                                    animationDelay: `${bar * 0.1}s`,
                                    opacity: isPlaying ? 1 : 0.3,
                                    transition: 'all 0.3s ease'
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Progress Slider & Time */}
            <div className="flex items-center gap-3 px-1">
                <span className="text-[10px] text-zinc-400 font-mono w-8 text-right">
                    {formatTime(currentTime)}
                </span>

                <div className="relative flex-1 h-4 flex items-center">
                    {/* Track Background */}
                    <div className="absolute inset-x-0 h-1 bg-white/10 rounded-full overflow-hidden">
                        {/* Progress Fill */}
                        <div
                            className={`h-full transition-all duration-100 ease-linear ${error ? "bg-red-500" : "bg-cyan-500"}`}
                            style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                        />
                    </div>

                    {/* Range Input (Invisible but interactive) */}
                    <input
                        type="range"
                        min="0"
                        max={duration || 0}
                        value={currentTime}
                        onChange={handleSeek}
                        disabled={error || !duration}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
                    />

                    {/* Thumb (Visual Only) */}
                    <div
                        className={`absolute h-3 w-3 bg-white rounded-full shadow-lg pointer-events-none transition-all duration-100 ease-linear ${error ? "bg-red-200" : ""}`}
                        style={{
                            left: `${duration ? (currentTime / duration) * 100 : 0}%`,
                            transform: 'translateX(-50%)'
                        }}
                    />
                </div>

                <span className="text-[10px] text-zinc-500 font-mono w-8">
                    {formatTime(duration)}
                </span>
            </div>
        </div>
    );
};

export default MessageAudioPlayer;
