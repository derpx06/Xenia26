import React, { useState, useEffect } from 'react';
import { Loader2, Send, X } from 'lucide-react';

const BACKEND_URL = "http://localhost:8080/api";
const getUserEmail = () => localStorage.getItem("userEmail") || "";

export default function ContactInputStep({ activeSendFlow, setActiveSendFlow, executeSend, loadingAction, onCancel }) {
    // State for "Add Contact" prompt
    const [isPrompting, setIsPrompting] = useState(false);
    const [newContactName, setNewContactName] = useState("");
    const [savingContact, setSavingContact] = useState(false);
    const [contacts, setContacts] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);

    useEffect(() => {
        const fetchContacts = async () => {
            try {
                const userEmail = getUserEmail();
                const res = await fetch(`${BACKEND_URL}/contacts?email=${encodeURIComponent(userEmail)}`, {
                    headers: { "x-user-email": userEmail }
                });
                if (res.ok) {
                    const data = await res.json();
                    setContacts(data);
                }
            } catch (e) {
                console.error("Failed to load contacts", e);
            }
        };
        fetchContacts();
    }, []);

    const filteredContacts = contacts.filter(c =>
        c.name.toLowerCase().includes((activeSendFlow.value || '').toLowerCase()) ||
        (c.email && c.email.toLowerCase().includes((activeSendFlow.value || '').toLowerCase())) ||
        (c.company && c.company.toLowerCase().includes((activeSendFlow.value || '').toLowerCase()))
    );

    const handleSelectContact = (contact) => {
        let value = "";
        if (activeSendFlow.type === 'email') value = contact.email;
        else if (activeSendFlow.type === 'whatsapp') value = contact.phone;
        else if (activeSendFlow.type === 'linkedin') value = contact.linkedinUrl || contact.name;

        setActiveSendFlow({ ...activeSendFlow, value });
        setShowDropdown(false);
    };

    const handleSendAction = async () => {
        const value = activeSendFlow.value;

        // Manual send for WhatsApp (empty target)
        if (!value && activeSendFlow.type === 'whatsapp') {
            executeSend("");
            return;
        }

        if (!value) return;

        // 1. Check if contact exists
        const exists = contacts.find(c =>
            c.email === value || c.phone === value || c.linkedinUrl === value || c.name === value
        );

        if (exists) {
            executeSend(value);
        } else {
            // 2. Prompt to add
            setIsPrompting(true);
        }
    };

    const handleSaveAndSend = async () => {
        if (!newContactName) return;
        setSavingContact(true);

        const newContact = {
            name: newContactName,
            email: activeSendFlow.type === 'email' ? activeSendFlow.value : "",
            phone: activeSendFlow.type === 'whatsapp' ? activeSendFlow.value : "",
            linkedinUrl: activeSendFlow.type === 'linkedin' ? activeSendFlow.value : "",
        };

        try {
            const res = await fetch(`${BACKEND_URL}/contacts`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-user-email": getUserEmail()
                },
                body: JSON.stringify({ ...newContact, userEmail: getUserEmail() })
            });

            if (res.ok) {
                // Update local list slightly so it doesn't prompt again immediately if reused (optional, but good UX)
                const saved = await res.json();
                setContacts([...contacts, saved]);
            }
        } catch (e) {
            console.error("Failed to save contact", e);
        } finally {
            setSavingContact(false);
            setIsPrompting(false);
            executeSend(activeSendFlow.value);
        }
    };

    const handleSkipAndSend = () => {
        setIsPrompting(false);
        executeSend(activeSendFlow.value);
    };

    if (isPrompting) {
        return (
            <div className="glass-panel p-3 rounded-xl animate-in zoom-in-95 max-w-md mb-2 flex flex-col gap-3">
                <div className="text-sm text-neutral-300">
                    <span className="font-bold text-white">{activeSendFlow.value}</span> is not in your contacts. Add them?
                </div>
                <input
                    autoFocus
                    placeholder="Enter Name for this contact..."
                    value={newContactName}
                    onChange={(e) => setNewContactName(e.target.value)}
                    className="bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-purple-500 outline-none"
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveAndSend()}
                />
                <div className="flex justify-end gap-2">
                    <button
                        onClick={handleSkipAndSend}
                        className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white transition-colors"
                        disabled={savingContact}
                    >
                        Don't Save
                    </button>
                    <button
                        onClick={handleSaveAndSend}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg flex items-center gap-2"
                        disabled={savingContact || !newContactName}
                    >
                        {savingContact && <Loader2 className="w-3 h-3 animate-spin" />}
                        Save & Send
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="relative w-full sm:max-w-md max-w-[90vw] mb-2 mx-auto">
            <div className="glass-panel p-2 rounded-xl flex items-center gap-2 animate-in zoom-in-95 relative z-20">
                <input
                    autoFocus
                    placeholder={
                        activeSendFlow.type === 'email' ? "Enter Email address..." :
                            activeSendFlow.type === 'whatsapp' ? "Enter Phone or leave empty for manual selection..." :
                                "Enter Recipient Name/URL..."
                    }
                    className="bg-transparent border-none outline-none text-sm text-white px-2 flex-1"
                    value={activeSendFlow.value || ''}
                    onChange={(e) => {
                        setActiveSendFlow({ ...activeSendFlow, value: e.target.value });
                        if (!showDropdown) setShowDropdown(true);
                    }}
                    onFocus={() => setShowDropdown(true)}
                    // Delay blur to allow click on dropdown items
                    onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && (activeSendFlow.value || activeSendFlow.type === 'whatsapp')) {
                            handleSendAction();
                            setShowDropdown(false);
                        }
                    }}
                />
                <button
                    onClick={() => onCancel && onCancel()}
                    className="bg-zinc-800 hover:bg-zinc-700 text-neutral-400 hover:text-white p-2 rounded-lg transition-colors border border-white/10"
                    title="Cancel"
                >
                    <X className="w-4 h-4" />
                </button>
                <button
                    onClick={() => (activeSendFlow.value || activeSendFlow.type === 'whatsapp') && handleSendAction()}
                    className="bg-purple-600 hover:bg-purple-500 text-white p-2 rounded-lg transition-colors shadow-lg shadow-purple-900/20"
                >
                    {loadingAction ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
            </div>

            {/* Dropdown */}
            {showDropdown && filteredContacts.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-[#111] border border-white/10 rounded-xl shadow-2xl max-h-60 overflow-y-auto z-10 animate-in slide-in-from-top-2 custom-scrollbar">
                    {filteredContacts.map(contact => (
                        <div
                            key={contact._id}
                            className="px-4 py-3 hover:bg-white/10 cursor-pointer flex items-center gap-3 transition-colors border-b border-white/5 last:border-0"
                            onMouseDown={(e) => {
                                e.preventDefault(); // Prevent blur
                                handleSelectContact(contact);
                            }}
                        >
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-900 to-slate-900 flex items-center justify-center text-xs font-bold text-white border border-white/10 shrink-0">
                                {contact.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm text-white font-medium truncate">{contact.name}</div>
                                <div className="text-xs text-neutral-500 truncate flex items-center gap-1">
                                    {activeSendFlow.type === 'email' ? (contact.email || "No email") :
                                        activeSendFlow.type === 'whatsapp' ? (contact.phone || "No phone") :
                                            (contact.linkedinUrl || "No LinkedIn")}
                                    {contact.company && <span className="text-neutral-600">• {contact.company}</span>}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
