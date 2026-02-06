import React, { useState, useEffect } from "react";
import {
    User,
    Mail,
    Building,
    Globe,
    Save,
    Shield,
    Key,
    LogOut,
    Camera,
    Loader2,
    Linkedin,
    Twitter,
    Github,
    Instagram,
    Link as LinkIcon
} from "lucide-react";
import Sidebar from "../components/Sidebar";

export default function Profile() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // 1. Initialize State with Empty Values (Dynamic)
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

    // 2. Load Data from "Database" (LocalStorage for Prototype)
    useEffect(() => {
        // Simulate API Fetch delay
        setTimeout(() => {
            const savedProfile = localStorage.getItem("userProfile");
            const sessionUser = localStorage.getItem("user"); // From Login

            if (savedProfile) {
                setFormData(JSON.parse(savedProfile));
            } else if (sessionUser) {
                // Fallback to session data if no profile exists yet
                const parsedSession = JSON.parse(sessionUser);
                setFormData(prev => ({
                    ...prev,
                    name: parsedSession.name || "User",
                    email: parsedSession.email || ""
                }));
            }
            setLoading(false);
        }, 600);
    }, []);

    // Handle Text Inputs
    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name.startsWith("social_")) {
            // Handle nested social object updates
            const socialKey = name.replace("social_", "");
            setFormData(prev => ({
                ...prev,
                socials: { ...prev.socials, [socialKey]: value }
            }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    // Handle Save (Persist to LocalStorage)
    const handleSave = () => {
        setSaving(true);
        // Simulate API Call
        setTimeout(() => {
            localStorage.setItem("userProfile", JSON.stringify(formData));
            // Also update the main session user if name changed
            const currentSession = JSON.parse(localStorage.getItem("user") || "{}");
            localStorage.setItem("user", JSON.stringify({ ...currentSession, name: formData.name }));

            setSaving(false);
            alert("Profile Saved Successfully!"); // Replace with Toast in real app
        }, 1000);
    };

    return (
        <div className="flex h-screen bg-[#050505] text-white overflow-hidden font-sans selection:bg-blue-500/30">
            <Sidebar />

            <main className="flex-1 flex flex-col h-full relative overflow-y-auto custom-scrollbar">
                {/* Decorative Background */}
                <div className="fixed top-0 left-0 w-full h-96 bg-purple-600/5 blur-[120px] pointer-events-none" />

                <div className="max-w-6xl mx-auto w-full p-6 lg:p-10 z-10 relative">

                    <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">Profile & Persona</h1>
                            <p className="text-neutral-400 text-sm mt-1">
                                Configure the identity your AI agent will use for outreach.
                            </p>
                        </div>
                        {/* Save Button (Top Right) */}
                        <button
                            onClick={handleSave}
                            disabled={saving || loading}
                            className="bg-white text-black hover:bg-neutral-200 px-6 py-2.5 rounded-xl font-medium flex items-center gap-2 transition shadow-[0_0_15px_rgba(255,255,255,0.1)] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {saving ? "Saving..." : "Save Changes"}
                        </button>
                    </div>

                    {loading ? (
                        <div className="h-96 flex items-center justify-center">
                            <Loader2 className="w-8 h-8 text-neutral-600 animate-spin" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                            {/* --- LEFT COLUMN: Identity Card --- */}
                            <div className="space-y-6">
                                <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-6 flex flex-col items-center text-center relative overflow-hidden">
                                    <div className="absolute top-0 w-full h-24 bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-blue-600/10" />

                                    <div className="relative mt-8 mb-4 group cursor-pointer">
                                        <div className="w-28 h-28 rounded-full bg-[#111] border-4 border-[#0A0A0A] flex items-center justify-center text-3xl font-bold text-neutral-300 shadow-2xl overflow-hidden relative">
                                            {/* Dynamic Initials */}
                                            {formData.name ? formData.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase() : <User />}

                                            {/* Hover Overlay */}
                                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Camera className="w-6 h-6 text-white" />
                                            </div>
                                        </div>
                                    </div>

                                    <h3 className="text-xl font-bold">{formData.name || "Anonymous User"}</h3>
                                    <p className="text-sm text-neutral-500">{formData.role || "No Role Set"}</p>

                                    <div className="mt-6 w-full space-y-2">
                                        <div className="flex justify-between text-xs text-neutral-400 py-3 border-b border-white/5">
                                            <span>Plan Status</span>
                                            <span className="text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">PRO</span>
                                        </div>
                                        <div className="flex justify-between text-xs text-neutral-400 py-3 border-b border-white/5">
                                            <span>Outreach Credits</span>
                                            <span className="text-white font-medium">850 / 1000</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Security Actions */}
                                <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-6">
                                    <h4 className="font-medium text-sm text-neutral-300 flex items-center gap-2 mb-4">
                                        <Shield className="w-4 h-4" /> Account Security
                                    </h4>
                                    <div className="space-y-2">
                                        <button className="w-full text-left text-xs text-neutral-400 hover:text-white hover:bg-white/5 p-2.5 rounded-lg transition-colors flex items-center justify-between group">
                                            Update Password
                                            <Key className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </button>
                                        <button className="w-full text-left text-xs text-red-400 hover:bg-red-500/10 p-2.5 rounded-lg transition-colors flex items-center justify-between">
                                            Sign Out
                                            <LogOut className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* --- RIGHT COLUMN: Edit Form --- */}
                            <div className="lg:col-span-2 space-y-6">

                                {/* 1. Core Identity */}
                                <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-8">
                                    <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                                        <User className="w-5 h-5 text-blue-500" />
                                        Core Identity
                                    </h3>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <InputField label="Full Name" name="name" value={formData.name} onChange={handleChange} placeholder="e.g. Rahul Sharma" />
                                        <InputField label="Job Title" name="role" value={formData.role} onChange={handleChange} placeholder="e.g. Founder & CEO" />
                                        <InputField label="Email Address" name="email" value={formData.email} onChange={handleChange} placeholder="name@company.com" icon={Mail} />
                                        <InputField label="Company Name" name="company" value={formData.company} onChange={handleChange} placeholder="e.g. TechFlow Solutions" icon={Building} />

                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">
                                                Professional Bio (AI Context)
                                            </label>
                                            <textarea
                                                name="bio"
                                                value={formData.bio}
                                                onChange={handleChange}
                                                rows="4"
                                                placeholder="Describe yourself, your writing style, and what you sell. The AI will read this to match your tone."
                                                className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all resize-none placeholder-neutral-700"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* 2. Social Presence (NEW SECTION) */}
                                <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-8">
                                    <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                                        <Globe className="w-5 h-5 text-purple-500" />
                                        Social Presence
                                    </h3>
                                    <p className="text-xs text-neutral-500 mb-6">
                                        Add your profiles so the AI can learn from your public posts (Optional).
                                    </p>

                                    <div className="space-y-4">
                                        <SocialInput
                                            label="LinkedIn Profile"
                                            name="social_linkedin"
                                            value={formData.socials.linkedin}
                                            onChange={handleChange}
                                            icon={Linkedin}
                                            color="text-blue-400"
                                        />
                                        <SocialInput
                                            label="Twitter / X"
                                            name="social_twitter"
                                            value={formData.socials.twitter}
                                            onChange={handleChange}
                                            icon={Twitter}
                                            color="text-sky-400"
                                        />
                                        <SocialInput
                                            label="GitHub"
                                            name="social_github"
                                            value={formData.socials.github}
                                            onChange={handleChange}
                                            icon={Github}
                                            color="text-white"
                                        />
                                        <SocialInput
                                            label="Instagram"
                                            name="social_instagram"
                                            value={formData.socials.instagram}
                                            onChange={handleChange}
                                            icon={Instagram}
                                            color="text-pink-400"
                                        />
                                        <SocialInput
                                            label="Website / Portfolio"
                                            name="website"
                                            value={formData.website}
                                            onChange={handleChange}
                                            icon={LinkIcon}
                                            color="text-emerald-400"
                                        />
                                    </div>
                                </div>

                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

// --- Reusable Components ---

const InputField = ({ label, name, value, onChange, placeholder, icon: Icon }) => (
    <div>
        <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">
            {label}
        </label>
        <div className="relative group">
            {Icon && (
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Icon className="h-4 w-4 text-neutral-600 group-focus-within:text-blue-500 transition-colors" />
                </div>
            )}
            <input
                type="text"
                name={name}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                className={`w-full bg-[#111] border border-white/10 rounded-xl py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder-neutral-700 ${Icon ? 'pl-10 pr-4' : 'px-4'}`}
            />
        </div>
    </div>
);

const SocialInput = ({ label, name, value, onChange, icon: Icon, color }) => (
    <div className="flex items-center gap-4 group">
        <div className={`p-2.5 rounded-lg bg-[#111] border border-white/5 ${color} group-hover:border-white/10 transition-colors`}>
            <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 relative">
            <input
                type="text"
                name={name}
                value={value}
                onChange={onChange}
                placeholder={`https://${label.toLowerCase().replace(" ", "")}.com/...`}
                className="w-full bg-transparent border-b border-white/10 py-2 text-sm text-white focus:outline-none focus:border-white/30 transition-all placeholder-neutral-700"
            />
            <label className="absolute -top-2.5 left-0 text-[10px] text-neutral-500 uppercase tracking-wider">
                {label}
            </label>
        </div>
    </div>
);