import React, { useState } from "react";
import { Search, Image as ImageIcon, ChevronRight, ChevronLeft, Loader2 } from "lucide-react";
import clsx from "clsx";
import { searchUnsplash } from "../utils/unsplash";
import "./MoodBoard.scss";

export const AssetBrowserSidebar = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [images, setImages] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const toggleSidebar = () => setIsOpen(!isOpen);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;

        setLoading(true);
        const results = await searchUnsplash(query);
        setImages(results || []);
        setLoading(false);
    };

    return (
        <>
            {/* Toggle Button */}
            {!isOpen && (
                <button
                    onClick={toggleSidebar}
                    className="auth-sidebar-toggle right"
                    title="Open Assets"
                >
                    <ImageIcon size={18} />
                </button>
            )}

            {/* Sidebar Panel */}
            <div className={clsx("moodboard-sidebar right", { open: isOpen })}>
                <div className="sidebar-header">
                    <button onClick={toggleSidebar}>
                        <ChevronRight size={20} />
                    </button>
                    <span>Assets</span>
                </div>

                <div className="p-3 border-b border-gray-200">
                    <form onSubmit={handleSearch} className="relative">
                        <input
                            type="text"
                            placeholder="Search Unsplash..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="w-full pl-8 pr-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-md text-sm outline-none focus:ring-1 focus:ring-primary"
                        />
                        <Search
                            size={14}
                            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
                        />
                    </form>
                </div>

                <div className="sidebar-content">
                    {loading ? (
                        <div className="flex justify-center p-4">
                            <Loader2 className="animate-spin text-primary" />
                        </div>
                    ) : (
                        <div className="masonry-grid">
                            {images.map((img) => (
                                <img
                                    key={img.id}
                                    src={img.thumb}
                                    alt={img.alt}
                                    draggable="true"
                                    onDragStart={(e) => {
                                        e.dataTransfer.setData("text/plain", img.url);
                                    }}
                                    title={`Photo by ${img.user}`}
                                />
                            ))}
                        </div>
                    )}
                    {!loading && images.length === 0 && query && (
                        <div className="text-center text-gray-400 mt-4 text-sm">
                            No images found.
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};
