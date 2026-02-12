import React, { useState, useEffect, useRef } from "react";
import {
    User, Mail, Building, Globe, Save, Loader2,
    Linkedin, Twitter, Github, Instagram, Link as LinkIcon,
    MapPin, Briefcase, Award, TrendingUp, ShieldCheck, CheckCircle2,
    Mic, Square, Play, Pause, Upload, Camera, Sparkles, ChevronRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Sidebar from "../components/Sidebar";
import ContactList from "../components/ContactList";

const BACKEND_URL = "http://localhost:8080/api";
const FASTAPI_URL = "http://127.0.0.1:8000";

const VOICE_CLONE_SCRIPT = "Hi, this is my voice sample for Xenia. I speak clearly at a natural pace. Please keep this tone warm, confident, and professional when generating my outreach audio.";

const blobToBase64 = (blob) =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result || "";
            const base64 = String(result).split(",")[1];
            if (!base64) {
                reject(new Error("Failed to encode audio"));
                return;
            }
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });

const audioBufferToWav = (audioBuffer) => {
    const numOfChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;

    const channelData = [];
    for (let i = 0; i < numOfChannels; i++) {
        channelData.push(audioBuffer.getChannelData(i));
    }

    const samples = audioBuffer.length;
    const blockAlign = numOfChannels * (bitDepth / 8);
    const byteRate = sampleRate * blockAlign;
    const dataSize = samples * blockAlign;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    const writeString = (offset, str) => {
        for (let i = 0; i < str.length; i++) {
            view.setUint8(offset + i, str.charCodeAt(i));
        }
    };

    let offset = 0;
    writeString(offset, "RIFF"); offset += 4;
    view.setUint32(offset, 36 + dataSize, true); offset += 4;
    writeString(offset, "WAVE"); offset += 4;
    writeString(offset, "fmt "); offset += 4;
    view.setUint32(offset, 16, true); offset += 4;
    view.setUint16(offset, format, true); offset += 2;
    view.setUint16(offset, numOfChannels, true); offset += 2;
    view.setUint32(offset, sampleRate, true); offset += 4;
    view.setUint32(offset, byteRate, true); offset += 4;
    view.setUint16(offset, blockAlign, true); offset += 2;
    view.setUint16(offset, bitDepth, true); offset += 2;
    writeString(offset, "data"); offset += 4;
    view.setUint32(offset, dataSize, true); offset += 4;

    for (let i = 0; i < samples; i++) {
        for (let c = 0; c < numOfChannels; c++) {
            const sample = Math.max(-1, Math.min(1, channelData[c][i] || 0));
            view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
            offset += 2;
        }
    }

    return buffer;
};

const convertBlobToWav = async (blob) => {
    const arrayBuffer = await blob.arrayBuffer();
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioCtx();
    try {
        const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
        const wavArrayBuffer = audioBufferToWav(decoded);
        return new Blob([wavArrayBuffer], { type: "audio/wav" });
    } finally {
        await audioContext.close();
    }
};

export default function Profile() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // 1. Initialize State
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        role: "",
        company: "",
        website: "",
        bio: "",
        socials: {
            linkedin: "",
            twitter: "",
            github: "",
            instagram: ""
        }
    });

    // Voice State
    const [recording, setRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState(null);
    const [audioUrl, setAudioUrl] = useState(null);
    const [savedAudioUrl, setSavedAudioUrl] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [voiceStatus, setVoiceStatus] = useState("");
    const [voiceSaving, setVoiceSaving] = useState(false);
    const [voiceTesting, setVoiceTesting] = useState(false);
    const [voiceProfileName, setVoiceProfileName] = useState("My Voice");
    const [voicePersonality, setVoicePersonality] = useState("professional");
    const [savedVoiceProfiles, setSavedVoiceProfiles] = useState([]);
    const [voicesLoading, setVoicesLoading] = useState(false);
    const [scrapingFields, setScrapingFields] = useState({});
    const scrapeTimersRef = useRef({});
    const lastScrapedLinkRef = useRef({});
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const audioPlayerRef = useRef(new Audio());

    // 2. Load Real Data
    useEffect(() => {
        const fetchProfile = async () => {
            const userEmail = localStorage.getItem("userEmail");
            if (!userEmail) {
                setLoading(false);
                return;
            }
            try {
                // Fetch profile from backend (source of truth)
                try {
                    const profileRes = await fetch(`${BACKEND_URL}/user/profile/${encodeURIComponent(userEmail)}`);
                    if (profileRes.ok) {
                        const profileData = await profileRes.json();
                        const user = profileData?.user || {};
                        setFormData(prev => ({
                            ...prev,
                            name: user.name || "",
                            email: user.email || userEmail,
                            role: user.role || "",
                            company: user.company || "",
                            website: user.website || "",
                            bio: user.bio || "",
                            socials: {
                                linkedin: user.socials?.linkedin || "",
                                twitter: user.socials?.twitter || "",
                                github: user.socials?.github || "",
                                instagram: user.socials?.instagram || ""
                            }
                        }));
                    } else {
                        // Fallback to local storage
                        setFormData(prev => ({
                            ...prev,
                            email: userEmail,
                            name: localStorage.getItem("userName") || "",
                            company: localStorage.getItem("userCompany") || "",
                            role: localStorage.getItem("userRole") || ""
                        }));
                    }
                } catch (err) {
                    console.error("Error fetching profile from backend:", err);
                }

                // Fetch Voice
                try {
                    const voiceRes = await fetch(`${BACKEND_URL}/user/voice/${userEmail}`);
                    if (voiceRes.ok) {
                        const blob = await voiceRes.blob();
                        const url = URL.createObjectURL(blob);
                        setSavedAudioUrl(url);
                    }
                } catch (err) {
                    console.error("No voice profile found or error fetching", err);
                }

                await fetchVoiceProfiles(userEmail);
            } catch (error) {
                console.error("Error loading profile:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, []);

    useEffect(() => {
        return () => {
            Object.values(scrapeTimersRef.current).forEach((t) => clearTimeout(t));
        };
    }, []);

    const fetchVoiceProfiles = async (emailOverride = null) => {
        const email = emailOverride || localStorage.getItem("userEmail");
        if (!email) return;
        try {
            setVoicesLoading(true);
            const res = await fetch(`${FASTAPI_URL}/ml/agent/sarge/voices?email=${encodeURIComponent(email)}`);
            if (!res.ok) return;
            const data = await res.json();
            const voices = data.custom_voices || [];
            setSavedVoiceProfiles(voices);
            const defaultVoice = voices.find(v => v.is_default);
            if (defaultVoice) {
                setVoiceProfileName(defaultVoice.name || "My Voice");
                setVoicePersonality(defaultVoice.personality || "professional");
            }
        } catch (error) {
            console.error("Failed to fetch saved voice profiles:", error);
        } finally {
            setVoicesLoading(false);
        }
    };

    // Handle Text Inputs
    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name.startsWith("social_")) {
            const socialKey = name.replace("social_", "");
            setFormData(prev => ({
                ...prev,
                socials: { ...prev.socials, [socialKey]: value }
            }));

            const fieldKey = `social_${socialKey}`;
            scheduleProfileScrape(fieldKey, value);
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
            if (name === "website") {
                scheduleProfileScrape("website", value);
            }
        }
    };

    const scheduleProfileScrape = (fieldKey, value) => {
        const link = (value || "").trim();
        if (scrapeTimersRef.current[fieldKey]) {
            clearTimeout(scrapeTimersRef.current[fieldKey]);
        }
        if (!link.startsWith("http")) return;
        scrapeTimersRef.current[fieldKey] = setTimeout(() => {
            scrapeProfileFromLink(fieldKey, link);
        }, 700);
    };

    const scrapeProfileFromLink = async (fieldKey, linkValue) => {
        const link = (linkValue || "").trim();
        if (!link.startsWith("http")) return;
        if (lastScrapedLinkRef.current[fieldKey] === link) return;
        try {
            setScrapingFields(prev => ({ ...prev, [fieldKey]: true }));
            const res = await fetch(`${FASTAPI_URL}/ml/scrape/links`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    context: "profile",
                    links: [link]
                })
            });
            if (!res.ok) return;
            const data = await res.json();
            const extracted = data?.extracted || {};

            setFormData(prev => ({
                ...prev,
                name: prev.name || extracted.name || "",
                role: prev.role || extracted.role || "",
                company: prev.company || extracted.company || "",
                website: prev.website || extracted.website || "",
                bio: prev.bio || extracted.bio || "",
                socials: {
                    linkedin: prev.socials.linkedin || extracted?.socials?.linkedin || "",
                    twitter: prev.socials.twitter || extracted?.socials?.twitter || "",
                    github: prev.socials.github || extracted?.socials?.github || "",
                    instagram: prev.socials.instagram || extracted?.socials?.instagram || "",
                }
            }));
            lastScrapedLinkRef.current[fieldKey] = link;
        } catch (error) {
            console.error(`Failed to scrape ${fieldKey}:`, error);
        } finally {
            setScrapingFields(prev => ({ ...prev, [fieldKey]: false }));
        }
    };

    // Handle Save Text Data
    const handleSave = async () => {
        setSaving(true);
        try {
            const userEmail = localStorage.getItem("userEmail");
            const payload = {
                ...formData,
                email: userEmail,
                socials: {
                    linkedin: formData.socials?.linkedin || "",
                    twitter: formData.socials?.twitter || "",
                    github: formData.socials?.github || "",
                    instagram: formData.socials?.instagram || "",
                }
            };
            const response = await fetch(`${BACKEND_URL}/user/profile`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const data = await response.json();

            if (response.ok) {
                localStorage.setItem("userName", formData.name);
                localStorage.setItem("userCompany", formData.company);
                localStorage.setItem("userRole", formData.role);
                localStorage.setItem("userWebsite", formData.website || "");
                localStorage.setItem("userBio", formData.bio || "");
                localStorage.setItem("userSocials", JSON.stringify(formData.socials || {}));

                const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
                const updatedUser = { ...currentUser, name: formData.name };
                localStorage.setItem("user", JSON.stringify(updatedUser)); // Keep consistent with Sidebar

                window.dispatchEvent(new Event("userUpdated"));
                // Could add a toast notification here
            } else {
                alert(`❌ Error: ${data.message}`);
            }
        } catch (error) {
            console.error(error);
            alert("Failed to connect to server.");
        } finally {
            setSaving(false);
        }
    };

    // --- Voice Functions ---

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const preferredTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
            const mimeType = preferredTypes.find((type) => MediaRecorder.isTypeSupported(type));
            mediaRecorderRef.current = mimeType
                ? new MediaRecorder(stream, { mimeType })
                : new MediaRecorder(stream);
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorderRef.current.onstop = () => {
                const blob = new Blob(audioChunksRef.current, {
                    type: mediaRecorderRef.current?.mimeType || "audio/webm"
                });
                setAudioBlob(blob);
                setAudioUrl(URL.createObjectURL(blob));
            };

            mediaRecorderRef.current.start();
            setRecording(true);
        } catch (err) {
            console.error("Error accessing microphone:", err);
            alert("Could not access microphone.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && recording) {
            mediaRecorderRef.current.stop();
            setRecording(false);
        }
    };

    const playAudio = (url) => {
        if (!url) return;

        if (audioPlayerRef.current.src !== url) {
            audioPlayerRef.current.src = url;
            audioPlayerRef.current.load();
        }

        if (isPlaying) {
            audioPlayerRef.current.pause();
            setIsPlaying(false);
        } else {
            audioPlayerRef.current.play();
            setIsPlaying(true);
            audioPlayerRef.current.onended = () => setIsPlaying(false);
        }
    };

    const uploadVoice = async () => {
        if (!audioBlob) return;
        const userEmail = localStorage.getItem("userEmail");
        if (!userEmail) {
            alert("Please login first.");
            return;
        }

        try {
            setVoiceSaving(true);
            setVoiceStatus("Converting recording to WAV...");
            const wavBlob = await convertBlobToWav(audioBlob);

            const formData = new FormData();
            formData.append("voice", wavBlob, "voice-intro.wav");
            formData.append("email", userEmail);

            setVoiceStatus("Saving voice profile...");
            const res = await fetch(`${BACKEND_URL}/user/voice`, {
                method: "POST",
                body: formData
            });

            if (!res.ok) {
                alert("Failed to upload voice.");
                setVoiceStatus("Failed to save voice profile.");
                return;
            }

            // Mirror the same sample to FastAPI so TTS cloning can actually use it.
            const audioBase64 = await blobToBase64(wavBlob);

            const ttsRes = await fetch(`${FASTAPI_URL}/ml/agent/sarge/voice-profile`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: userEmail,
                    audio_base64: audioBase64,
                    extension: ".wav",
                    profile_name: voiceProfileName,
                    personality: voicePersonality,
                    use_as_default: true
                })
            });

            if (!ttsRes.ok) {
                const err = await ttsRes.text();
                setVoiceStatus(`Saved to profile, but TTS clone setup failed: ${err}`);
                return;
            }

            setSavedAudioUrl(URL.createObjectURL(wavBlob));
            setAudioBlob(null);
            setAudioUrl(null);
            setVoiceStatus("Voice profile saved. TTS cloning is ready.");
            await fetchVoiceProfiles(userEmail);
        } catch (error) {
            console.error("Upload Error:", error);
            alert("Error uploading voice.");
            setVoiceStatus("Error uploading voice profile.");
        } finally {
            setVoiceSaving(false);
        }
    };

    const setDefaultVoiceProfile = async (profileId) => {
        try {
            const res = await fetch(`${FASTAPI_URL}/ml/agent/sarge/voice-profiles/${profileId}/default`, {
                method: "PATCH"
            });
            if (!res.ok) {
                throw new Error("Failed to set default voice");
            }
            setVoiceStatus("Default voice updated.");
            await fetchVoiceProfiles();
        } catch (error) {
            console.error(error);
            setVoiceStatus("Failed to update default voice.");
        }
    };

    const deleteVoiceProfile = async (profileId) => {
        try {
            const res = await fetch(`${FASTAPI_URL}/ml/agent/sarge/voice-profiles/${profileId}`, {
                method: "DELETE"
            });
            if (!res.ok) {
                throw new Error("Failed to delete voice");
            }
            setVoiceStatus("Voice profile deleted.");
            await fetchVoiceProfiles();
        } catch (error) {
            console.error(error);
            setVoiceStatus("Failed to delete voice profile.");
        }
    };

    const testClonedVoice = async () => {
        const userEmail = localStorage.getItem("userEmail");
        if (!userEmail) {
            alert("Please login first.");
            return;
        }

        try {
            setVoiceTesting(true);
            setVoiceStatus("Generating cloned voice preview...");
            const res = await fetch(`${FASTAPI_URL}/ml/agent/sarge/voice`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    text: VOICE_CLONE_SCRIPT,
                    email: userEmail
                })
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data?.detail || "Voice preview failed");
            }
            if (data.audio_url) {
                const audio = new Audio(`${FASTAPI_URL}${data.audio_url}`);
                await audio.play();
                setVoiceStatus(
                    data.used_cloned_voice
                        ? "Cloned voice preview generated successfully."
                        : "Audio generated, but clone profile was not applied."
                );
            }
        } catch (error) {
            console.error("Voice test error:", error);
            setVoiceStatus("Voice preview failed. Re-record and try again.");
        } finally {
            setVoiceTesting(false);
        }
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
    };

    return (
        <div className="flex h-screen bg-[#020202] text-white overflow-hidden font-sans selection:bg-purple-500/30">
            <Sidebar />

            <main className="flex-1 flex flex-col h-full relative overflow-y-auto custom-scrollbar">
                {/* Background Atmosphere */}
                <div className="fixed top-0 left-0 w-full h-[500px] bg-gradient-to-b from-blue-900/10 to-transparent pointer-events-none" />
                <div className="fixed -top-40 -right-40 w-96 h-96 bg-purple-600/10 blur-[120px] pointer-events-none" />

                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="max-w-7xl mx-auto w-full p-6 md:p-8 lg:p-12 z-10 relative"
                >

                    {/* Page Header */}
                    <div className="mb-10 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-white/5 pb-6">
                        <div>
                            <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-white mb-2 flex items-center gap-3">
                                <User className="w-8 h-8 text-purple-400" />
                                Account Settings
                            </h1>
                            <p className="text-neutral-400 text-sm">Manage your personal profile and workspace preferences.</p>
                        </div>
                        <button
                            onClick={handleSave}
                            disabled={saving || loading}
                            className="group relative inline-flex items-center gap-2 px-6 py-2.5 bg-white text-black rounded-xl font-bold text-sm hover:bg-neutral-200 transition-all shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {saving ? "Saving Changes..." : "Save Profile"}
                        </button>
                    </div>

                    {loading ? (
                        <div className="h-64 flex items-center justify-center">
                            <Loader2 className="w-8 h-8 text-neutral-600 animate-spin" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                            {/* --- LEFT COLUMN (Profile Card) --- */}
                            <motion.div variants={itemVariants} className="lg:col-span-4 space-y-6">
                                {/* Identity Card */}
                                <div className="bg-[#0A0A0A] border border-white/5 rounded-3xl overflow-hidden relative group transition-all duration-300 hover:border-white/10 shadow-2xl">
                                    {/* Cover Image */}
                                    <div className="h-36 w-full bg-gradient-to-r from-slate-900 via-purple-900 to-slate-900 relative">
                                        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-soft-light"></div>
                                        <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 text-[10px] font-bold tracking-wider text-white uppercase flex items-center gap-1.5">
                                            <Sparkles className="w-3 h-3 text-amber-400" />
                                            PRO CLASS
                                        </div>
                                    </div>

                                    <div className="px-6 pb-6 relative">
                                        {/* Avatar */}
                                        <div className="relative -mt-16 mb-4 inline-block">
                                            <div className="w-28 h-28 rounded-3xl bg-[#0A0A0A] p-1.5 border border-white/10 shadow-2xl relative overflow-hidden group-hover:scale-105 transition-transform duration-500">
                                                <div className="w-full h-full rounded-2xl bg-gradient-to-br from-[#1a1a1a] to-black flex items-center justify-center text-4xl font-bold text-white relative overflow-hidden">
                                                    {/* Gradient Text Initials */}
                                                    <span className="relative z-10 bg-gradient-to-br from-white to-neutral-500 bg-clip-text text-transparent">
                                                        {formData.name ? formData.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase() : "AI"}
                                                    </span>
                                                    {/* Glow effect */}
                                                    <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/0 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                                </div>
                                            </div>
                                            <div className="absolute -bottom-2 -right-2 p-1.5 bg-blue-500 rounded-full border-[4px] border-[#0A0A0A] shadow-lg" title="Verified Account">
                                                <ShieldCheck className="w-4 h-4 text-white" />
                                            </div>
                                        </div>

                                        {/* Name & Role */}
                                        <div className="mb-6">
                                            <h2 className="text-2xl font-bold text-white mb-1 tracking-tight">
                                                {formData.name || "Anonymous User"}
                                            </h2>
                                            <div className="flex items-center gap-2 text-sm text-neutral-400 font-medium">
                                                <Briefcase className="w-4 h-4 text-purple-400" />
                                                <span>{formData.role || "No Role Set"}</span>
                                                {formData.company && (
                                                    <>
                                                        <span className="w-1 h-1 rounded-full bg-neutral-600" />
                                                        <span className="text-neutral-300">{formData.company}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* Quick Stats */}
                                        <div className="grid grid-cols-2 gap-3 py-4 border-t border-white/5">
                                            <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
                                                <div className="text-xs text-neutral-500 mb-1 font-semibold uppercase tracking-wider">Campaigns</div>
                                                <div className="text-lg font-bold text-white flex items-center gap-2">
                                                    12 <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                                                </div>
                                            </div>
                                            <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
                                                <div className="text-xs text-neutral-500 mb-1 font-semibold uppercase tracking-wider">Avg Open Rate</div>
                                                <div className="text-lg font-bold text-white flex items-center gap-2">
                                                    48% <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded">Top 10%</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Status Badge */}
                                        <div className="mt-4 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/10 text-xs font-bold text-emerald-400">
                                            <div className="relative flex h-2 w-2">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                            </div>
                                            System Active & Ready
                                        </div>
                                    </div>
                                </div>
                            </motion.div>

                            {/* --- RIGHT COLUMN (Forms) --- */}
                            <motion.div variants={itemVariants} className="lg:col-span-8">
                                <div className="space-y-8">

                                    {/* Section 1: Personal Details */}
                                    <section>
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400"><User className="w-5 h-5" /></div>
                                            <h3 className="text-lg font-bold text-white">Personal Details</h3>
                                        </div>

                                        <div className="bg-[#0A0A0A]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-6 md:p-8 space-y-6 shadow-xl">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <ModernInput label="Full Name" name="name" value={formData.name} onChange={handleChange} placeholder="e.g. Rahul Sharma" />
                                                <ModernInput label="Job Title" name="role" value={formData.role} onChange={handleChange} placeholder="e.g. Head of Growth" />
                                            </div>
                                            <ModernInput label="Email Address" name="email" value={formData.email} onChange={handleChange} placeholder="name@company.com" icon={Mail} />

                                            <div>
                                                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2.5 ml-1">Bio & Context</label>
                                                <textarea
                                                    name="bio"
                                                    value={formData.bio}
                                                    onChange={handleChange}
                                                    rows="4"
                                                    placeholder="Briefly describe your role and expertise. The AI uses this to personalize your tone."
                                                    className="w-full bg-[#0F0F0F] border border-white/5 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all resize-none placeholder-neutral-700"
                                                />
                                            </div>
                                        </div>
                                    </section>

                                    {/* --- VOICE INTRO SECTION --- */}
                                    <section>
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="p-2 rounded-xl bg-pink-500/10 text-pink-400"><Mic className="w-5 h-5" /></div>
                                            <h3 className="text-lg font-bold text-white">Voice Intro</h3>
                                        </div>

                                        <div className="bg-[#0A0A0A]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden">
                                            {/* Decorative blob */}
                                            <div className="absolute -right-20 -top-20 w-64 h-64 bg-pink-500/5 blur-[80px] rounded-full pointer-events-none" />

                                            <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">

                                                {/* Controls */}
                                                <div className="flex items-center gap-4">
                                                    {!recording ? (
                                                        <button
                                                            onClick={startRecording}
                                                            className="group flex flex-col items-center justify-center w-24 h-24 rounded-full bg-neutral-900 border border-white/10 hover:border-red-500/50 hover:bg-red-500/10 transition-all duration-300"
                                                        >
                                                            <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center shadow-[0_0_15px_rgba(239,68,68,0.5)] group-hover:scale-110 transition-transform">
                                                                <Mic className="w-4 h-4 text-white fill-white" />
                                                            </div>
                                                            <span className="text-[10px] font-bold text-neutral-400 mt-2 uppercase tracking-wider group-hover:text-red-400">Record</span>
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={stopRecording}
                                                            className="group flex flex-col items-center justify-center w-24 h-24 rounded-full bg-neutral-900 border border-white/10 hover:border-neutral-500 hover:bg-neutral-800 transition-all duration-300"
                                                        >
                                                            <div className="w-8 h-8 rounded-md bg-white flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.5)] animate-pulse">
                                                                <Square className="w-4 h-4 text-neutral-900 fill-neutral-900" />
                                                            </div>
                                                            <span className="text-[10px] font-bold text-white mt-2 uppercase tracking-wider">Stop</span>
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Player / Visualizer */}
                                                <div className="flex-1 w-full relative">
                                                    <div className="mb-4 p-4 rounded-2xl bg-neutral-900/60 border border-white/10">
                                                        <div className="text-[11px] uppercase tracking-wider text-neutral-500 font-bold mb-2">Recommended Recording Script</div>
                                                        <p className="text-sm text-neutral-300 leading-relaxed">{VOICE_CLONE_SCRIPT}</p>
                                                        <p className="text-xs text-neutral-500 mt-2">
                                                            Record 20-30 seconds in a quiet room, steady pace, no music or background noise.
                                                        </p>
                                                    </div>

                                                    <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="block text-[10px] uppercase tracking-wider text-neutral-500 font-bold mb-2">Voice Name</label>
                                                            <input
                                                                value={voiceProfileName}
                                                                onChange={(e) => setVoiceProfileName(e.target.value)}
                                                                placeholder="e.g. Founder Voice"
                                                                className="w-full bg-[#0F0F0F] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] uppercase tracking-wider text-neutral-500 font-bold mb-2">Personality</label>
                                                            <input
                                                                value={voicePersonality}
                                                                onChange={(e) => setVoicePersonality(e.target.value)}
                                                                placeholder="e.g. friendly, assertive, calm"
                                                                className="w-full bg-[#0F0F0F] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
                                                            />
                                                        </div>
                                                    </div>

                                                    {recording ? (
                                                        <div className="flex items-center gap-3 h-20 px-6 rounded-2xl bg-neutral-900/50 border border-white/5">
                                                            <div className="flex items-center gap-1 h-8 flex-1 justify-center">
                                                                {[...Array(20)].map((_, i) => (
                                                                    <motion.div
                                                                        key={i}
                                                                        className="w-1 bg-red-500 rounded-full"
                                                                        animate={{
                                                                            height: [8, Math.random() * 24 + 8, 8],
                                                                            opacity: [0.5, 1, 0.5]
                                                                        }}
                                                                        transition={{
                                                                            duration: 0.5,
                                                                            repeat: Infinity,
                                                                            delay: i * 0.05
                                                                        }}
                                                                    />
                                                                ))}
                                                            </div>
                                                            <div className="text-xs font-mono text-red-500 animate-pulse">REC</div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-4 p-5 rounded-2xl bg-white/5 border border-white/5">
                                                            {(audioUrl || savedAudioUrl) ? (
                                                                <>
                                                                    <button
                                                                        onClick={() => playAudio(audioUrl || savedAudioUrl)}
                                                                        className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-black hover:scale-105 transition-transform shadow-lg shadow-white/10"
                                                                    >
                                                                        {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                                                                    </button>

                                                                    <div className="flex-1 space-y-2">
                                                                        <div className="flex justify-between items-center text-xs text-neutral-400 font-medium">
                                                                            <span>{audioUrl ? "New Recording" : "Saved Intro"}</span>
                                                                            <span>0:15 / 0:30</span>
                                                                        </div>
                                                                        <div className="h-1.5 bg-neutral-800 rounded-full w-full overflow-hidden">
                                                                            <motion.div
                                                                                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                                                                                initial={{ width: "30%" }}
                                                                                animate={{ width: isPlaying ? "100%" : "30%" }}
                                                                                transition={{ duration: 30, ease: "linear" }}
                                                                            />
                                                                        </div>
                                                                    </div>

                                                                    {audioUrl && (
                                                                        <button
                                                                            onClick={uploadVoice}
                                                                            disabled={voiceSaving}
                                                                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-blue-900/20"
                                                                        >
                                                                            {voiceSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                                                                            {voiceSaving ? "Saving..." : "Save"}
                                                                        </button>
                                                                    )}
                                                                </>
                                                            ) : (
                                                                <div className="flex flex-col items-center justify-center w-full py-2 text-neutral-500 gap-2">
                                                                    <Mic className="w-6 h-6 opacity-50" />
                                                                    <span className="text-sm">No voice intro recorded yet</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    <div className="mt-4 flex flex-wrap items-center gap-3">
                                                        <button
                                                            onClick={testClonedVoice}
                                                            disabled={voiceTesting || (!savedAudioUrl && !audioUrl)}
                                                            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                                        >
                                                            {voiceTesting ? "Testing..." : "Test Cloned Voice"}
                                                        </button>
                                                        {voiceStatus && <span className="text-xs text-neutral-400">{voiceStatus}</span>}
                                                    </div>

                                                    <div className="mt-5 border-t border-white/10 pt-4">
                                                        <div className="flex items-center justify-between mb-3">
                                                            <div className="text-xs uppercase tracking-wider text-neutral-500 font-bold">Saved Voice Personalities</div>
                                                            <button
                                                                onClick={() => fetchVoiceProfiles()}
                                                                className="text-[11px] text-blue-400 hover:text-blue-300"
                                                            >
                                                                Refresh
                                                            </button>
                                                        </div>

                                                        {voicesLoading ? (
                                                            <div className="text-xs text-neutral-500">Loading voices...</div>
                                                        ) : savedVoiceProfiles.length === 0 ? (
                                                            <div className="text-xs text-neutral-500">No saved custom voices yet.</div>
                                                        ) : (
                                                            <div className="space-y-2">
                                                                {savedVoiceProfiles.map((voice) => (
                                                                    <div key={voice.id} className="p-3 rounded-xl border border-white/10 bg-black/30 flex items-center justify-between gap-3">
                                                                        <div>
                                                                            <div className="text-sm text-white font-semibold">
                                                                                {voice.name} {voice.is_default ? <span className="text-[10px] text-emerald-400 ml-1">(Default)</span> : null}
                                                                            </div>
                                                                            <div className="text-xs text-neutral-400">{voice.personality || "professional"}</div>
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            {!voice.is_default && (
                                                                                <button
                                                                                    onClick={() => setDefaultVoiceProfile(voice.id)}
                                                                                    className="px-2 py-1 rounded-lg bg-blue-600/20 border border-blue-500/40 text-[11px] text-blue-300 hover:bg-blue-600/30"
                                                                                >
                                                                                    Set Default
                                                                                </button>
                                                                            )}
                                                                            <button
                                                                                onClick={() => deleteVoiceProfile(voice.id)}
                                                                                className="px-2 py-1 rounded-lg bg-red-600/20 border border-red-500/40 text-[11px] text-red-300 hover:bg-red-600/30"
                                                                            >
                                                                                Delete
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                            </div>
                                        </div>
                                    </section>

                                    {/* Section 2: Professional Brand */}
                                    <section>
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400"><Building className="w-5 h-5" /></div>
                                            <h3 className="text-lg font-bold text-white">Professional Brand</h3>
                                        </div>

                                        <div className="bg-[#0A0A0A]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-6 md:p-8 space-y-6 shadow-xl">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <ModernInput label="Company Name" name="company" value={formData.company} onChange={handleChange} placeholder="e.g. Spacerocket" icon={Building} />
                                                <ModernInput
                                                    label="Website"
                                                    name="website"
                                                    value={formData.website}
                                                    onChange={handleChange}
                                                    onBlur={(e) => scrapeProfileFromLink("website", e.target.value)}
                                                    loading={!!scrapingFields.website}
                                                    placeholder="https://..."
                                                    icon={Globe}
                                                />
                                            </div>

                                            <div className="pt-6 border-t border-white/5">
                                                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-5">Social Presence</label>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <SocialInput
                                                        label="LinkedIn"
                                                        name="social_linkedin"
                                                        value={formData.socials.linkedin}
                                                        onChange={handleChange}
                                                        onBlur={(e) => scrapeProfileFromLink("social_linkedin", e.target.value)}
                                                        loading={!!scrapingFields.social_linkedin}
                                                        icon={Linkedin}
                                                        color="group-hover:text-[#0077b5]"
                                                    />
                                                    <SocialInput
                                                        label="Twitter"
                                                        name="social_twitter"
                                                        value={formData.socials.twitter}
                                                        onChange={handleChange}
                                                        onBlur={(e) => scrapeProfileFromLink("social_twitter", e.target.value)}
                                                        loading={!!scrapingFields.social_twitter}
                                                        icon={Twitter}
                                                        color="group-hover:text-[#1DA1F2]"
                                                    />
                                                    <SocialInput
                                                        label="GitHub"
                                                        name="social_github"
                                                        value={formData.socials.github}
                                                        onChange={handleChange}
                                                        onBlur={(e) => scrapeProfileFromLink("social_github", e.target.value)}
                                                        loading={!!scrapingFields.social_github}
                                                        icon={Github}
                                                        color="group-hover:text-white"
                                                    />
                                                    <SocialInput
                                                        label="Instagram"
                                                        name="social_instagram"
                                                        value={formData.socials.instagram}
                                                        onChange={handleChange}
                                                        onBlur={(e) => scrapeProfileFromLink("social_instagram", e.target.value)}
                                                        loading={!!scrapingFields.social_instagram}
                                                        icon={Instagram}
                                                        color="group-hover:text-[#E1306C]"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </section>

                                    {/* Section 3: Contacts */}
                                    <section>
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400"><User className="w-5 h-5" /></div>
                                            <h3 className="text-lg font-bold text-white">Saved Contacts</h3>
                                        </div>
                                        <div className="bg-[#0A0A0A]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-6 md:p-8 shadow-xl">
                                            <ContactList />
                                        </div>
                                    </section>

                                </div>
                            </motion.div>

                        </div>
                    )}
                </motion.div>
            </main>
        </div>
    );
}

// --- Modern Components ---

const ModernInput = ({ label, name, value, onChange, onBlur, loading, placeholder, icon: Icon }) => (
    <div className="relative group">
        <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-2 ml-1 group-focus-within:text-blue-500 transition-colors">
            {label}
        </label>
        <div className="relative">
            {Icon && (
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Icon className="h-4 w-4 text-neutral-600 group-focus-within:text-blue-500 transition-colors" />
                </div>
            )}
            <input
                type="text"
                name={name}
                value={value}
                onChange={onChange}
                onBlur={onBlur}
                placeholder={placeholder}
                className={`w-full bg-[#0F0F0F] border border-white/10 rounded-2xl py-3.5 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder-neutral-700 hover:bg-[#141414] hover:border-white/20 ${Icon ? 'pl-11 pr-10' : 'px-4'}`}
            />
            {loading && (
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                </div>
            )}
        </div>
    </div>
);

const SocialInput = ({ label, name, value, onChange, onBlur, loading, icon: Icon, color }) => (
    <div className="flex items-center gap-3 group p-1.5 rounded-2xl transition-all duration-300 focus-within:bg-white/[0.02] hover:bg-white/[0.02] border border-transparent focus-within:border-white/5">
        <div className={`p-3 rounded-xl bg-[#0F0F0F] border border-white/5 text-neutral-500 ${color} transition-colors group-hover:scale-105 shadow-sm`}>
            <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 relative">
            <input
                type="text"
                name={name}
                value={value}
                onChange={onChange}
                onBlur={onBlur}
                placeholder={`${label} URL...`}
                className="w-full bg-transparent border-none py-2 pr-7 text-sm text-neutral-300 focus:text-white focus:outline-none transition-all placeholder-neutral-700 focus:ring-0"
            />
            {loading && (
                <div className="absolute right-0 top-1/2 -translate-y-1/2 pr-1">
                    <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                </div>
            )}
        </div>
    </div>
);
