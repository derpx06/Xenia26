import React, { useState, useEffect } from 'react';
import { Plus, Search, Mail, Phone, Trash2, Loader2, Briefcase } from 'lucide-react';
import Sidebar from '../components/Sidebar';

// ⚠️ CHECK YOUR TERMINAL: Is your backend running on 5000 or 8080?
// If 'node server.js' says 5000, change this to 5000.
const API_URL = "http://localhost:8080/api/contacts";

export default function ContactBook() {
    const [contacts, setContacts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        name: '', email: '', phone: '', company: '', role: ''
    });

    // Get current user (Optional - safe check)
    const user = JSON.parse(localStorage.getItem("user"));

    // --- 1. FETCH CONTACTS ON LOAD ---
    useEffect(() => {
        const fetchContacts = async () => {
            try {
                const res = await fetch(API_URL);
                const data = await res.json();

                // Safety check: Ensure data is an array before setting state
                if (Array.isArray(data)) {
                    setContacts(data);
                } else {
                    console.error("API did not return an array:", data);
                    setContacts([]);
                }
            } catch (err) {
                console.error("Error fetching contacts:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchContacts();
    }, []);

    // --- 2. HANDLE SAVE (CREATE) ---
    const handleSave = async () => {
        // Validation
        if (!formData.name) return alert("Please enter a Name.");

        try {
            const res = await fetch(API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...formData,
                    // If no user is logged in, send null. It works globally.
                    userId: user?._id || null
                }),
            });

            const savedContact = await res.json();

            if (!res.ok) {
                throw new Error(savedContact.message || "Failed to save");
            }

            // Update UI immediately
            const newContactList = [savedContact, ...contacts];
            setContacts(newContactList);
            setShowModal(false);
            setFormData({ name: '', email: '', phone: '', company: '', role: '' });

            // Sync with Chat Agent logic
            localStorage.setItem('contacts', JSON.stringify(newContactList));

        } catch (err) {
            console.error("Error saving contact:", err);
            alert(`Error saving contact. Ensure backend is running at ${API_URL}`);
        }
    };

    // --- 3. HANDLE DELETE ---
    const handleDelete = async (id) => {
        if (!window.confirm("Delete this contact?")) return;

        try {
            await fetch(`${API_URL}/${id}`, { method: "DELETE" });

            const updated = contacts.filter(c => c._id !== id);
            setContacts(updated);

            // Sync with Chat Agent
            localStorage.setItem('contacts', JSON.stringify(updated));
        } catch (err) {
            console.error("Error deleting:", err);
        }
    };

    return (
        <div className="flex h-screen bg-[#050505] text-white font-sans overflow-hidden">
            <Sidebar />
            <main className="flex-1 p-8 overflow-y-auto custom-scrollbar relative">

                {/* Header */}
                <div className="flex justify-between items-end mb-8 border-b border-white/5 pb-6">
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                            Contact Book
                        </h1>
                        <p className="text-neutral-400 mt-1">
                            Manage the targets for your AI Outreach Agent.
                        </p>
                    </div>
                    <button
                        onClick={() => setShowModal(true)}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 font-medium transition-all shadow-lg shadow-blue-900/20"
                    >
                        <Plus className="w-4 h-4" /> Add Contact
                    </button>
                </div>

                {/* Loading State */}
                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                    </div>
                ) : (
                    /* Contact Grid */
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {contacts.length === 0 ? (
                            <div className="col-span-full text-center text-neutral-500 py-20 border border-dashed border-white/10 rounded-2xl">
                                <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p>No contacts found. Add one to start.</p>
                            </div>
                        ) : (
                            contacts.map((c) => (
                                <div key={c._id} className="bg-[#0A0A0A] border border-white/10 p-5 rounded-2xl hover:border-blue-500/30 transition-all group relative">
                                    <button
                                        onClick={() => handleDelete(c._id)}
                                        className="absolute top-4 right-4 text-neutral-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>

                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-900/40 to-purple-900/40 border border-white/10 flex items-center justify-center text-lg font-bold text-white">
                                            {c.name ? c.name[0].toUpperCase() : "?"}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg text-white leading-tight">{c.name}</h3>
                                            <p className="text-xs text-blue-400 font-medium">{c.role}</p>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        {c.company && (
                                            <div className="flex items-center gap-2 text-sm text-neutral-400 bg-white/5 p-2 rounded-lg">
                                                <Briefcase className="w-3 h-3 text-neutral-500" /> {c.company}
                                            </div>
                                        )}
                                        <div className="grid grid-cols-2 gap-2">
                                            {c.email && (
                                                <a href={`mailto:${c.email}`} className="flex items-center gap-2 text-xs text-neutral-400 hover:text-white bg-white/5 p-2 rounded-lg transition-colors overflow-hidden">
                                                    <Mail className="w-3 h-3 text-orange-400 shrink-0" /> <span className="truncate">{c.email}</span>
                                                </a>
                                            )}
                                            {c.phone && (
                                                <a href={`https://wa.me/${c.phone}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs text-neutral-400 hover:text-white bg-white/5 p-2 rounded-lg transition-colors">
                                                    <Phone className="w-3 h-3 text-green-400 shrink-0" /> <span className="truncate">{c.phone}</span>
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </main>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
                    <div className="bg-[#111] border border-white/10 p-6 rounded-2xl w-full max-w-md shadow-2xl">
                        <h2 className="text-xl font-bold mb-4">Add New Target</h2>
                        <div className="space-y-3">
                            <input
                                placeholder="Full Name (Required)"
                                className="w-full bg-[#050505] border border-white/10 p-3 rounded-xl text-sm focus:border-blue-500 outline-none transition"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                            <input
                                placeholder="Role (e.g. CTO)"
                                className="w-full bg-[#050505] border border-white/10 p-3 rounded-xl text-sm focus:border-blue-500 outline-none transition"
                                value={formData.role}
                                onChange={e => setFormData({ ...formData, role: e.target.value })}
                            />
                            <input
                                placeholder="Company"
                                className="w-full bg-[#050505] border border-white/10 p-3 rounded-xl text-sm focus:border-blue-500 outline-none transition"
                                value={formData.company}
                                onChange={e => setFormData({ ...formData, company: e.target.value })}
                            />
                            <div className="grid grid-cols-2 gap-3">
                                <input
                                    placeholder="Email"
                                    className="w-full bg-[#050505] border border-white/10 p-3 rounded-xl text-sm focus:border-blue-500 outline-none transition"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                />
                                <input
                                    placeholder="Phone (WhatsApp)"
                                    className="w-full bg-[#050505] border border-white/10 p-3 rounded-xl text-sm focus:border-blue-500 outline-none transition"
                                    value={formData.phone}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 justify-end mt-6">
                            <button onClick={() => setShowModal(false)} className="text-neutral-400 hover:text-white px-4 py-2 text-sm">Cancel</button>
                            <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg shadow-blue-900/20">Save Target</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}