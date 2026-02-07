import React, { useState, useEffect } from "react";
import {
    User, Mail, Building, Globe, Save, Loader2,
    Linkedin, Twitter, Github, Instagram, Link as LinkIcon,
    MapPin, Briefcase, Award, TrendingUp, ShieldCheck, CheckCircle2
} from "lucide-react";
import Sidebar from "../components/Sidebar";

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

    // 2. Load Real Data
    useEffect(() => {
        const fetchProfile = async () => {
            const userEmail = localStorage.getItem("userEmail");
            if (!userEmail) {
                setLoading(false);
                return;
            }
            try {
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

    // Handle Save
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
                localStorage.setItem("user", JSON.stringify(updatedUser));

                window.dispatchEvent(new Event("userUpdated"));
                // Small delay to visually show the "Saved" state if we had one, sticking to alert for now but maybe we can do better? 
                // Let's stick to the existing pattern but maybe a toast later.
                alert("✅ Profile Updated Successfully");
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

    return (
        <div className="flex h-screen bg-[#020202] text-white overflow-hidden font-sans selection:bg-purple-500/30">
            <Sidebar />

            <main className="flex-1 flex flex-col h-full relative overflow-y-auto custom-scrollbar">
                {/* Background Atmosphere */}
                <div className="fixed top-0 left-0 w-full h-[500px] bg-gradient-to-b from-blue-900/10 to-transparent pointer-events-none" />
                <div className="fixed -top-40 -right-40 w-96 h-96 bg-purple-600/10 blur-[120px] pointer-events-none" />

                <div className="max-w-7xl mx-auto w-full p-4 md:p-8 lg:p-12 z-10 relative">

                    {/* Page Header */}
                    <div className="mb-10 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-white/5 pb-6">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Account Settings</h1>
                            <p className="text-neutral-400 text-sm">Manage your personal profile and workspace preferences.</p>
                        </div>
                        <button
                            onClick={handleSave}
                            disabled={saving || loading}
                            className="group relative inline-flex items-center gap-2 px-6 py-2.5 bg-white text-black rounded-xl font-semibold text-sm hover:bg-neutral-200 transition-all shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
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
                            <div className="lg:col-span-4 space-y-6">
                                {/* Identity Card */}
                                <div className="bg-[#0A0A0A] border border-white/5 rounded-3xl overflow-hidden relative group transition-all duration-300 hover:border-white/10">
                                    {/* Cover Image */}
                                    <div className="h-32 w-full bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 relative">
                                        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-soft-light"></div>
                                        <div className="absolute top-4 right-4 bg-black/20 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 text-[10px] font-bold tracking-wider text-white uppercase">
                                            PRO CLASS
                                        </div>
                                    </div>

                                    <div className="px-6 pb-6 relative">
                                        {/* Avatar */}
                                        <div className="relative -mt-12 mb-4 inline-block">
                                            <div className="w-24 h-24 rounded-2xl bg-[#111] border-[4px] border-[#0A0A0A] flex items-center justify-center text-3xl font-bold text-neutral-200 shadow-2xl relative overflow-hidden group-hover:scale-105 transition-transform duration-500">
                                                {/* Gradient Text Initials */}
                                                <span className="bg-gradient-to-br from-white to-neutral-500 bg-clip-text text-transparent">
                                                    {formData.name ? formData.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase() : "AI"}
                                                </span>
                                            </div>
                                            <div className="absolute -bottom-2 -right-2 p-1.5 bg-blue-600 rounded-full border-[4px] border-[#0A0A0A] shadow-lg" title="Verified Account">
                                                <ShieldCheck className="w-3.5 h-3.5 text-white" />
                                            </div>
                                        </div>

                                        {/* Name & Role */}
                                        <div className="mb-6">
                                            <h2 className="text-xl font-bold text-white mb-1">
                                                {formData.name || "Anonymous User"}
                                            </h2>
                                            <div className="flex items-center gap-2 text-sm text-neutral-400">
                                                <Briefcase className="w-3.5 h-3.5" />
                                                <span>{formData.role || "No Role Set"}</span>
                                                {formData.company && (
                                                    <>
                                                        <span className="w-1 h-1 rounded-full bg-neutral-600" />
                                                        <span>{formData.company}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* Quick Stats (Dummy for visuals) */}
                                        <div className="grid grid-cols-2 gap-3 py-4 border-t border-white/5">
                                            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                                                <div className="text-xs text-neutral-500 mb-1">Campigns</div>
                                                <div className="text-lg font-bold text-white flex items-center gap-2">
                                                    12 <TrendingUp className="w-3 h-3 text-emerald-500" />
                                                </div>
                                            </div>
                                            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                                                <div className="text-xs text-neutral-500 mb-1">Avg Open Rate</div>
                                                <div className="text-lg font-bold text-white flex items-center gap-2">
                                                    48% <span className="text-[10px] text-neutral-500 font-normal">top 10%</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Status Badge */}
                                        <div className="mt-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-xs text-emerald-400">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                            System Active & Ready
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* --- RIGHT COLUMN (Forms) --- */}
                            <div className="lg:col-span-8">
                                <div className="space-y-8">

                                    {/* Section 1: Personal Details */}
                                    <section>
                                        <div className="flex items-center gap-2 mb-6">
                                            <div className="p-1.5 rounded bg-blue-500/10 text-blue-400"><User className="w-4 h-4" /></div>
                                            <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-300">Personal Details</h3>
                                        </div>

                                        <div className="bg-[#0A0A0A] border border-white/5 rounded-3xl p-6 md:p-8 space-y-6">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <ModernInput label="Full Name" name="name" value={formData.name} onChange={handleChange} placeholder="e.g. Rahul Sharma" />
                                                <ModernInput label="Job Title" name="role" value={formData.role} onChange={handleChange} placeholder="e.g. Head of Growth" />
                                            </div>
                                            <ModernInput label="Email Address" name="email" value={formData.email} onChange={handleChange} placeholder="name@company.com" icon={Mail} />

                                            <div>
                                                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2 ml-1">Bio & Context</label>
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

                                    {/* Section 2: Professional Brand */}
                                    <section>
                                        <div className="flex items-center gap-2 mb-6">
                                            <div className="p-1.5 rounded bg-purple-500/10 text-purple-400"><Building className="w-4 h-4" /></div>
                                            <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-300">Professional Brand</h3>
                                        </div>

                                        <div className="bg-[#0A0A0A] border border-white/5 rounded-3xl p-6 md:p-8 space-y-6">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <ModernInput label="Company Name" name="company" value={formData.company} onChange={handleChange} placeholder="e.g. Spacerocket" icon={Building} />
                                                <ModernInput label="Website" name="website" value={formData.website} onChange={handleChange} placeholder="https://..." icon={Globe} />
                                            </div>

                                            <div className="pt-4 border-t border-white/5">
                                                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-4">Social Presence</label>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <SocialInput label="LinkedIn" name="social_linkedin" value={formData.socials.linkedin} onChange={handleChange} icon={Linkedin} color="group-hover:text-[#0077b5]" />
                                                    <SocialInput label="Twitter" name="social_twitter" value={formData.socials.twitter} onChange={handleChange} icon={Twitter} color="group-hover:text-[#1DA1F2]" />
                                                    <SocialInput label="GitHub" name="social_github" value={formData.socials.github} onChange={handleChange} icon={Github} color="group-hover:text-white" />
                                                    <SocialInput label="Instagram" name="social_instagram" value={formData.socials.instagram} onChange={handleChange} icon={Instagram} color="group-hover:text-[#E1306C]" />
                                                </div>
                                            </div>
                                        </div>
                                    </section>

                                </div>
                            </div>

                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

// --- Modern Components ---

const ModernInput = ({ label, name, value, onChange, placeholder, icon: Icon }) => (
    <div className="relative group">
        <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1.5 ml-1 group-focus-within:text-blue-500 transition-colors">
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
                className={`w-full bg-[#0F0F0F] border border-white/5 rounded-2xl py-3 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder-neutral-700 hover:bg-[#141414] ${Icon ? 'pl-11 pr-4' : 'px-4'}`}
            />
        </div>
    </div>
);

const SocialInput = ({ label, name, value, onChange, icon: Icon, color }) => (
    <div className="flex items-center gap-3 group p-1 rounded-xl transition-all duration-300 focus-within:bg-white/[0.02]">
        <div className={`p-2.5 rounded-xl bg-[#0F0F0F] border border-white/5 text-neutral-500 ${color} transition-colors group-hover:scale-110 shadow-sm`}>
            <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 relative">
            <input
                type="text"
                name={name}
                value={value}
                onChange={onChange}
                placeholder={`${label} URL...`}
                className="w-full bg-transparent border-0 border-b border-transparent focus:border-white/10 py-2 text-sm text-neutral-300 focus:text-white focus:outline-none transition-all placeholder-neutral-700"
            />
        </div>
    </div>
);