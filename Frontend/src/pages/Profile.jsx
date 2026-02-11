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

                setFormData(prev => ({
                    ...prev,
                    email: userEmail,
                    name: localStorage.getItem("userName") || "",
                    company: localStorage.getItem("userCompany") || "",
                    role: localStorage.getItem("userRole") || ""
                }));
            } catch (error) {
                console.error("Error loading profile:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, []);

    // Handle Text Inputs
    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name.startsWith("social_")) {
            const socialKey = name.replace("social_", "");
            setFormData(prev => ({
                ...prev,
                socials: { ...prev.socials, [socialKey]: value }
            }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    // Handle Save Text Data
    const handleSave = async () => {
        setSaving(true);
        try {
            const userEmail = localStorage.getItem("userEmail");
            const response = await fetch(`${BACKEND_URL}/user/profile`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...formData, email: userEmail })
            });
            const data = await response.json();

            if (response.ok) {
                localStorage.setItem("userName", formData.name);
                localStorage.setItem("userCompany", formData.company);
                localStorage.setItem("userRole", formData.role);

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
            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorderRef.current.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
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
        const formData = new FormData();
        formData.append("voice", audioBlob, "voice-intro.webm");
        formData.append("email", userEmail);

        try {
            const res = await fetch(`${BACKEND_URL}/user/voice`, {
                method: "POST",
                body: formData
            });

            if (res.ok) {
                setSavedAudioUrl(URL.createObjectURL(audioBlob)); // Update saved URL
                setAudioBlob(null); // Clear pending blob
                setAudioUrl(null);
            } else {
                alert("Failed to upload voice.");
            }
        } catch (error) {
            console.error("Upload Error:", error);
            alert("Error uploading voice.");
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
                                                                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-blue-900/20"
                                                                        >
                                                                            <Upload className="w-3.5 h-3.5" />
                                                                            Save
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
                                                <ModernInput label="Website" name="website" value={formData.website} onChange={handleChange} placeholder="https://..." icon={Globe} />
                                            </div>

                                            <div className="pt-6 border-t border-white/5">
                                                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-5">Social Presence</label>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <SocialInput label="LinkedIn" name="social_linkedin" value={formData.socials.linkedin} onChange={handleChange} icon={Linkedin} color="group-hover:text-[#0077b5]" />
                                                    <SocialInput label="Twitter" name="social_twitter" value={formData.socials.twitter} onChange={handleChange} icon={Twitter} color="group-hover:text-[#1DA1F2]" />
                                                    <SocialInput label="GitHub" name="social_github" value={formData.socials.github} onChange={handleChange} icon={Github} color="group-hover:text-white" />
                                                    <SocialInput label="Instagram" name="social_instagram" value={formData.socials.instagram} onChange={handleChange} icon={Instagram} color="group-hover:text-[#E1306C]" />
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

const ModernInput = ({ label, name, value, onChange, placeholder, icon: Icon }) => (
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
                placeholder={placeholder}
                className={`w-full bg-[#0F0F0F] border border-white/10 rounded-2xl py-3.5 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder-neutral-700 hover:bg-[#141414] hover:border-white/20 ${Icon ? 'pl-11 pr-4' : 'px-4'}`}
            />
        </div>
    </div>
);

const SocialInput = ({ label, name, value, onChange, icon: Icon, color }) => (
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
                placeholder={`${label} URL...`}
                className="w-full bg-transparent border-none py-2 text-sm text-neutral-300 focus:text-white focus:outline-none transition-all placeholder-neutral-700 focus:ring-0"
            />
        </div>
    </div>
);