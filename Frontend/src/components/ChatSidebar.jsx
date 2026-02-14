import React from 'react';
import { Plus, MessageSquare, Trash2, MoreHorizontal, Edit2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, isToday, isYesterday, subDays } from 'date-fns';

const ChatSidebar = ({
    sessions,
    activeSessionId,
    onSelectSession,
    onCreateSession,
    onDeleteSession,
    onRenameSession
}) => {
    // Group sessions by date
    const groupedSessions = sessions.reduce((groups, session) => {
        const date = new Date(session.lastUpdated);
        let key = 'Older';

        if (isToday(date)) key = 'Today';
        else if (isYesterday(date)) key = 'Yesterday';
        else if (date > subDays(new Date(), 7)) key = 'Previous 7 Days';
        else if (date > subDays(new Date(), 30)) key = 'Previous 30 Days';

        if (!groups[key]) groups[key] = [];
        groups[key].push(session);
        return groups;
    }, {});

    const groupOrder = ['Today', 'Yesterday', 'Previous 7 Days', 'Previous 30 Days', 'Older'];

    return (
        <div className="w-64 flex-shrink-0 bg-[#0A0A0A] border-r border-white/5 flex flex-col h-full">
            {/* New Chat Button */}
            <div className="p-4">
                <button
                    onClick={onCreateSession}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium text-neutral-200 transition-all hover:border-purple-500/30 group"
                >
                    <div className="p-1 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg group-hover:shadow-lg group-hover:shadow-purple-900/20 transition-all">
                        <Plus className="w-4 h-4 text-white" />
                    </div>
                    <span>New Chat</span>
                </button>
            </div>

            {/* Sessions List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-4 space-y-6">
                {groupOrder.map(group => {
                    const groupSessions = groupedSessions[group];
                    if (!groupSessions?.length) return null;

                    return (
                        <div key={group} className="animate-in fade-in slide-in-from-left-2 duration-500">
                            <h3 className="px-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                                {group}
                            </h3>
                            <div className="space-y-1">
                                {groupSessions.map(session => (
                                    <SessionItem
                                        key={session._id}
                                        session={session}
                                        isActive={activeSessionId === session._id}
                                        onSelect={() => onSelectSession(session._id)}
                                        onDelete={() => onDeleteSession(session._id)}
                                        onRename={(newTitle) => onRenameSession(session._id, newTitle)}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const SessionItem = ({ session, isActive, onSelect, onDelete, onRename }) => {
    const [isHovered, setIsHovered] = React.useState(false);
    const [isEditing, setIsEditing] = React.useState(false);
    const [editTitle, setEditTitle] = React.useState(session.title);
    const [showOptions, setShowOptions] = React.useState(false);
    const menuRef = React.useRef(null);

    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setShowOptions(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleRenameSubmit = (e) => {
        e.preventDefault();
        if (editTitle.trim()) {
            onRename(editTitle.trim());
            setIsEditing(false);
            setShowOptions(false);
        }
    };

    if (isEditing) {
        return (
            <form onSubmit={handleRenameSubmit} className="px-2 py-1">
                <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={() => setIsEditing(false)}
                    className="w-full bg-[#1A1A1A] border border-blue-500/50 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-blue-500"
                    autoFocus
                />
            </form>
        );
    }

    return (
        <div
            className={`group relative flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all ${isActive ? 'bg-purple-500/10 text-white' : 'text-neutral-400 hover:bg-white/5 hover:text-neutral-200'
                }`}
            onClick={onSelect}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => { setIsHovered(false); setShowOptions(false); }}
        >
            <MessageSquare className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-purple-400' : 'text-neutral-600'}`} />

            <span className="text-sm truncate flex-1 relative z-10">
                {session.title || "Untitled Chat"}
            </span>

            {/* Options Menu Trigger */}
            {(isActive || isHovered) && (
                <div className="relative" ref={menuRef}>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowOptions(!showOptions);
                        }}
                        className="p-1 hover:bg-white/10 rounded-md transition-colors text-neutral-500 hover:text-white"
                    >
                        <MoreHorizontal className="w-3 h-3" />
                    </button>

                    {/* Dropdown Menu */}
                    <AnimatePresence>
                        {showOptions && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 5 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 5 }}
                                className="absolute right-0 top-full mt-1 w-32 bg-[#1A1A1A] border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden"
                            >
                                <div className="p-1">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setIsEditing(true);
                                            setShowOptions(false);
                                        }}
                                        className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-neutral-300 hover:bg-white/10 rounded-md transition-colors"
                                    >
                                        <Edit2 className="w-3 h-3" /> Rename
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (window.confirm("Delete this chat?")) onDelete();
                                        }}
                                        className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                                    >
                                        <Trash2 className="w-3 h-3" /> Delete
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}

            {/* Active Indicator Bar */}
            {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-0.5 bg-purple-500 rounded-r-full" />
            )}
        </div>
    );
};

export default ChatSidebar;
