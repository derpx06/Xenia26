import React, { useState, useEffect, useRef } from 'react';
import { Plus, Search, MoreVertical, Phone, Mail, Linkedin, Trash2, Edit2, X, Loader2, User, Building, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const BACKEND_URL = "http://localhost:8080/api";
const FASTAPI_URL = "http://127.0.0.1:8000";
const getUserEmail = () => localStorage.getItem("userEmail") || "";

export default function ContactList() {
    const [contacts, setContacts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingContact, setEditingContact] = useState(null);
    const [saving, setSaving] = useState(false);
    const [scrapingFields, setScrapingFields] = useState({});
    const scrapeTimersRef = useRef({});
    const lastScrapedRef = useRef({});

    // Form State
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        linkedinUrl: "",
        role: "",
        company: "",
        notes: ""
    });

    useEffect(() => {
        fetchContacts();
    }, []);

    const fetchContacts = async () => {
        setLoading(true);
        try {
            const userEmail = getUserEmail();
            const res = await fetch(`${BACKEND_URL}/contacts?email=${encodeURIComponent(userEmail)}`, {
                headers: { "x-user-email": userEmail }
            });
            if (res.ok) {
                const data = await res.json();
                setContacts(data);
            }
        } catch (error) {
            console.error("Error fetching contacts:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (contact = null) => {
        if (contact) {
            setEditingContact(contact);
            setFormData({
                name: contact.name,
                email: contact.email || "",
                phone: contact.phone || "",
                linkedinUrl: contact.linkedinUrl || "",
                role: contact.role || "",
                company: contact.company || "",
                notes: contact.notes || ""
            });
        } else {
            setEditingContact(null);
            setFormData({
                name: "",
                email: "",
                phone: "",
                linkedinUrl: "",
                role: "",
                company: "",
                notes: ""
            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingContact(null);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
        if (name === "linkedinUrl" || name === "notes") {
            scheduleContactScrape(name, value);
        }
    };

    const scheduleContactScrape = (fieldKey, value) => {
        if (scrapeTimersRef.current[fieldKey]) {
            clearTimeout(scrapeTimersRef.current[fieldKey]);
        }
        const links = fieldKey === "notes" ? extractUrls(value) : [value];
        const normalizedLinks = links.map((l) => (l || "").trim()).filter((l) => l.startsWith("http"));
        if (normalizedLinks.length === 0) return;

        scrapeTimersRef.current[fieldKey] = setTimeout(() => {
            scrapeContactFromLinks(fieldKey, value);
        }, 700);
    };

    const extractUrls = (text) => {
        const matches = (text || "").match(/https?:\/\/[^\s]+/g);
        return matches || [];
    };

    const scrapeContactFromLinks = async (fieldKey, rawValue) => {
        const links = fieldKey === "notes" ? extractUrls(rawValue) : [rawValue];
        const normalizedLinks = links.map((l) => (l || "").trim()).filter((l) => l.startsWith("http"));
        if (normalizedLinks.length === 0) return;
        const cacheKey = `${fieldKey}:${normalizedLinks.join("|")}`;
        if (lastScrapedRef.current[fieldKey] === cacheKey) return;

        try {
            setScrapingFields(prev => ({ ...prev, [fieldKey]: true }));
            const res = await fetch(`${FASTAPI_URL}/ml/scrape/links`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    context: "contact",
                    links: normalizedLinks
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
                email: prev.email || extracted.email || "",
                linkedinUrl: prev.linkedinUrl || extracted.linkedinUrl || "",
                notes: prev.notes || extracted.notes || ""
            }));
            lastScrapedRef.current[fieldKey] = cacheKey;
        } catch (error) {
            console.error(`Failed to scrape contact from ${fieldKey}:`, error);
        } finally {
            setScrapingFields(prev => ({ ...prev, [fieldKey]: false }));
        }
    };

    useEffect(() => {
        return () => {
            Object.values(scrapeTimersRef.current).forEach((t) => clearTimeout(t));
        };
    }, []);

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const url = editingContact
                ? `${BACKEND_URL}/contacts/${editingContact._id}`
                : `${BACKEND_URL}/contacts`;
            const method = editingContact ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: {
                    "Content-Type": "application/json",
                    "x-user-email": getUserEmail()
                },
                body: JSON.stringify({ ...formData, userEmail: getUserEmail() })
            });

            if (res.ok) {
                fetchContacts(); // Refresh list
                handleCloseModal();
            } else {
                alert("Failed to save contact");
            }
        } catch (error) {
            console.error("Error saving contact:", error);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id, e) => {
        e.stopPropagation(); // Prevent opening edit modal
        if (!window.confirm("Are you sure you want to delete this contact?")) return;
        try {
            const userEmail = getUserEmail();
            await fetch(`${BACKEND_URL}/contacts/${id}?email=${encodeURIComponent(userEmail)}`, {
                method: "DELETE",
                headers: { "x-user-email": userEmail }
            });
            setContacts(contacts.filter(c => c._id !== id));
        } catch (error) {
            console.error("Error deleting contact:", error);
        }
    };

    const filteredContacts = contacts.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Header / Toolbar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#0F0F0F] p-2 rounded-2xl border border-white/5 relative z-20">
                <div className="relative flex-1 w-full sm:max-w-md group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 group-focus-within:text-purple-400 transition-colors" />
                    <input
                        type="text"
                        placeholder="Search contacts by name, company, or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-transparent border-none rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:ring-0 placeholder-neutral-600"
                    />
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 px-5 py-2.5 bg-white text-black text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-lg hover:shadow-white/20 hover:scale-105"
                >
                    <Plus className="w-4 h-4" />
                    Add Contact
                </button>
            </div>

            {/* List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AnimatePresence mode='popLayout'>
                    {loading ? (
                        <div className="col-span-full py-12 flex justify-center">
                            <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                        </div>
                    ) : filteredContacts.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="col-span-full py-12 flex flex-col items-center justify-center text-center text-neutral-500 bg-[#0F0F0F] rounded-3xl border border-dashed border-white/10"
                        >
                            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                                <User className="w-8 h-8 opacity-40" />
                            </div>
                            <p className="text-lg font-medium text-white mb-1">No contacts found</p>
                            <p className="text-sm">Try searching for something else or add a new contact.</p>
                        </motion.div>
                    ) : (
                        filteredContacts.map((contact, i) => (
                            <motion.div
                                layout
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                transition={{ delay: i * 0.05 }}
                                key={contact._id}
                                className="group relative bg-[#0F0F0F] border border-white/5 hover:border-purple-500/30 rounded-2xl p-5 transition-all hover:bg-[#141414] hover:shadow-xl hover:shadow-purple-900/10 cursor-default"
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-neutral-800 to-black border border-white/10 flex items-center justify-center text-lg font-bold text-white shadow-inner group-hover:scale-110 transition-transform duration-300">
                                            {contact.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-white text-base leading-tight group-hover:text-purple-400 transition-colors">{contact.name}</h4>
                                            <div className="flex items-center gap-1.5 text-xs text-neutral-400 mt-1">
                                                {contact.role && <span>{contact.role}</span>}
                                                {contact.company && (
                                                    <>
                                                        <span className="w-1 h-1 rounded-full bg-neutral-600" />
                                                        <span className="flex items-center gap-1"><Building className="w-3 h-3" /> {contact.company}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                        <button
                                            onClick={() => handleOpenModal(contact)}
                                            className="p-2 hover:bg-white/10 rounded-xl text-neutral-400 hover:text-white transition-colors"
                                            title="Edit"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={(e) => handleDelete(contact._id, e)}
                                            className="p-2 hover:bg-red-500/10 rounded-xl text-neutral-400 hover:text-red-400 transition-colors"
                                            title="Delete"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 mt-2">
                                    {contact.email && (
                                        <a href={`mailto:${contact.email}`} className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.03] hover:bg-white/10 transition-colors text-xs text-neutral-300 overflow-hidden">
                                            <Mail className="w-3.5 h-3.5 shrink-0 text-blue-400" />
                                            <span className="truncate">{contact.email}</span>
                                        </a>
                                    )}
                                    {contact.phone && (
                                        <a href={`tel:${contact.phone}`} className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.03] hover:bg-white/10 transition-colors text-xs text-neutral-300 overflow-hidden">
                                            <Phone className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                                            <span className="truncate">{contact.phone}</span>
                                        </a>
                                    )}
                                </div>

                                {contact.linkedinUrl && (
                                    <a
                                        href={contact.linkedinUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="mt-2 flex items-center justify-center gap-2 w-full py-2 rounded-xl bg-[#0077b5]/10 text-[#0077b5] text-xs font-bold uppercase tracking-wider hover:bg-[#0077b5]/20 transition-colors"
                                    >
                                        <Linkedin className="w-3.5 h-3.5" /> View Profile
                                    </a>
                                )}
                            </motion.div>
                        ))
                    )}
                </AnimatePresence>
            </div>

            {/* Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                            onClick={handleCloseModal}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-[#111] border border-white/10 rounded-3xl w-full max-w-lg shadow-2xl p-0 relative z-10 overflow-hidden flex flex-col max-h-[90vh]"
                        >
                            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#151515]">
                                <h2 className="text-xl font-bold text-white">
                                    {editingContact ? "Edit Contact" : "Add New Contact"}
                                </h2>
                                <button onClick={handleCloseModal} className="p-2 hover:bg-white/10 rounded-full text-neutral-500 hover:text-white transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-6 overflow-y-auto custom-scrollbar">
                                <form id="contact-form" onSubmit={handleSave} className="space-y-5">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider ml-1">Name</label>
                                            <input required name="name" value={formData.name} onChange={handleChange} className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-purple-500 outline-none transition-colors focus:bg-[#0F0F0F]" placeholder="John Doe" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider ml-1">Role</label>
                                            <input name="role" value={formData.role} onChange={handleChange} className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-purple-500 outline-none transition-colors focus:bg-[#0F0F0F]" placeholder="CEO" />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider ml-1">Company</label>
                                        <div className="relative">
                                            <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600" />
                                            <input name="company" value={formData.company} onChange={handleChange} className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:border-purple-500 outline-none transition-colors focus:bg-[#0F0F0F]" placeholder="Acme Inc." />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider ml-1">Email</label>
                                            <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-purple-500 outline-none transition-colors focus:bg-[#0F0F0F]" placeholder="john@example.com" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider ml-1">Phone</label>
                                            <input name="phone" value={formData.phone} onChange={handleChange} className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-purple-500 outline-none transition-colors focus:bg-[#0F0F0F]" placeholder="+1 234..." />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider ml-1">LinkedIn URL</label>
                                        <div className="relative">
                                            <Linkedin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600" />
                                            <input
                                                name="linkedinUrl"
                                                value={formData.linkedinUrl}
                                                onChange={handleChange}
                                                onBlur={(e) => scrapeContactFromLinks("linkedinUrl", e.target.value)}
                                                className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl pl-10 pr-10 py-3 text-sm text-white focus:border-purple-500 outline-none transition-colors focus:bg-[#0F0F0F]"
                                                placeholder="https://linkedin.com/in/..."
                                            />
                                            {scrapingFields.linkedinUrl && (
                                                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400 animate-spin" />
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider ml-1">Notes</label>
                                        <div className="relative">
                                            <textarea
                                                name="notes"
                                                value={formData.notes}
                                                onChange={handleChange}
                                                onBlur={(e) => scrapeContactFromLinks("notes", e.target.value)}
                                                rows="3"
                                                className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-4 pr-10 py-3 text-sm text-white focus:border-purple-500 outline-none resize-none transition-colors focus:bg-[#0F0F0F]"
                                                placeholder="Additional context... (links here will be auto-scraped)"
                                            />
                                            {scrapingFields.notes && (
                                                <Loader2 className="absolute right-3 top-3 w-4 h-4 text-purple-400 animate-spin" />
                                            )}
                                        </div>
                                    </div>
                                </form>
                            </div>

                            <div className="p-6 border-t border-white/5 bg-[#151515]">
                                <button
                                    type="submit"
                                    form="contact-form"
                                    disabled={saving}
                                    className="w-full bg-white text-black font-bold py-3.5 rounded-xl transition-all shadow-lg hover:bg-neutral-200 flex justify-center items-center gap-2"
                                >
                                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {saving ? "Saving..." : (editingContact ? "Update Contact" : "Create Contact")}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
