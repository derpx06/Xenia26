import React, { useState, useEffect } from 'react';
import { Plus, Search, MoreVertical, Phone, Mail, Linkedin, Trash2, Edit2, X, Loader2, User } from 'lucide-react';

const BACKEND_URL = "http://localhost:8080/api";

export default function ContactList() {
    const [contacts, setContacts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingContact, setEditingContact] = useState(null);
    const [saving, setSaving] = useState(false);

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
            const res = await fetch(`${BACKEND_URL}/contacts`);
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
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

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
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
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

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this contact?")) return;
        try {
            await fetch(`${BACKEND_URL}/contacts/${id}`, { method: "DELETE" });
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
        <div className="space-y-4">
            {/* Header / Toolbar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="relative flex-1 w-full sm:max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                    <input
                        type="text"
                        placeholder="Search contacts..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-[#0F0F0F] border border-white/5 rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50 transition-colors"
                    />
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-xl transition-all shadow-lg shadow-purple-900/20"
                >
                    <Plus className="w-4 h-4" />
                    Add Contact
                </button>
            </div>

            {/* List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {loading ? (
                    <div className="col-span-full py-8 text-center text-neutral-500 flex justify-center">
                        <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                ) : filteredContacts.length === 0 ? (
                    <div className="col-span-full py-8 text-center text-neutral-500 bg-[#0F0F0F] rounded-2xl border border-dashed border-white/10">
                        <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No contacts found.</p>
                    </div>
                ) : (
                    filteredContacts.map(contact => (
                        <div key={contact._id} className="group bg-[#0A0A0A] border border-white/5 hover:border-white/10 rounded-2xl p-4 transition-all relative">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-900 to-slate-900 flex items-center justify-center text-sm font-bold text-white border border-white/10">
                                        {contact.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-white text-sm">{contact.name}</h4>
                                        <p className="text-xs text-neutral-500">{contact.role} {contact.company && `at ${contact.company}`}</p>
                                    </div>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleOpenModal(contact)} className="p-1.5 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-white"><Edit2 className="w-3.5 h-3.5" /></button>
                                    <button onClick={() => handleDelete(contact._id)} className="p-1.5 hover:bg-red-500/10 rounded-lg text-neutral-400 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                                </div>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                                {contact.email && (
                                    <div className="flex items-center gap-1.5 px-2 py-1 bg-white/5 rounded-lg text-[10px] text-neutral-300">
                                        <Mail className="w-3 h-3" /> {contact.email}
                                    </div>
                                )}
                                {contact.phone && (
                                    <div className="flex items-center gap-1.5 px-2 py-1 bg-white/5 rounded-lg text-[10px] text-neutral-300">
                                        <Phone className="w-3 h-3" /> {contact.phone}
                                    </div>
                                )}
                                {contact.linkedinUrl && (
                                    <a href={contact.linkedinUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-2 py-1 bg-[#0077b5]/10 text-[#0077b5] rounded-lg text-[10px] hover:bg-[#0077b5]/20">
                                        <Linkedin className="w-3 h-3" /> LinkedIn
                                    </a>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#111] border border-white/10 rounded-3xl w-full max-w-lg shadow-2xl p-6 relative animate-in zoom-in-95 duration-200">
                        <button onClick={handleCloseModal} className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full text-neutral-500 hover:text-white transition-colors">
                            <X className="w-5 h-5" />
                        </button>

                        <h2 className="text-xl font-bold text-white mb-6">
                            {editingContact ? "Edit Contact" : "Add New Contact"}
                        </h2>

                        <form onSubmit={handleSave} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider ml-1">Name</label>
                                    <input required name="name" value={formData.name} onChange={handleChange} className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-purple-500 outline-none" placeholder="John Doe" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider ml-1">Role</label>
                                    <input name="role" value={formData.role} onChange={handleChange} className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-purple-500 outline-none" placeholder="CEO" />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider ml-1">Company</label>
                                <input name="company" value={formData.company} onChange={handleChange} className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-purple-500 outline-none" placeholder="Acme Inc." />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider ml-1">Email</label>
                                    <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-purple-500 outline-none" placeholder="john@example.com" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider ml-1">Phone</label>
                                    <input name="phone" value={formData.phone} onChange={handleChange} className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-purple-500 outline-none" placeholder="+1 234 567 890" />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider ml-1">LinkedIn URL</label>
                                <input name="linkedinUrl" value={formData.linkedinUrl} onChange={handleChange} className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-purple-500 outline-none" placeholder="https://linkedin.com/in/john" />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider ml-1">Notes</label>
                                <textarea name="notes" value={formData.notes} onChange={handleChange} rows="3" className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-purple-500 outline-none resize-none" placeholder="Met at conference..." />
                            </div>

                            <div className="pt-4">
                                <button disabled={saving} type="submit" className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg flex justify-center items-center gap-2">
                                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {saving ? "Saving..." : (editingContact ? "Update Contact" : "Create Contact")}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
