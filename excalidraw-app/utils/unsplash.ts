export const searchUnsplash = async (query: string, page = 1) => {
    const accessKey = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;
    if (!accessKey) {
        console.warn("Unsplash Access Key is missing!");
        return [];
    }

    try {
        const response = await fetch(
            `https://api.unsplash.com/search/photos?page=${page}&query=${encodeURIComponent(
                query,
            )}&per_page=20&client_id=${accessKey}`,
        );

        if (!response.ok) {
            throw new Error("Failed to fetch from Unsplash");
        }

        const data = await response.json();
        return data.results.map((img: any) => ({
            id: img.id,
            url: img.urls.regular,
            thumb: img.urls.small,
            alt: img.alt_description,
            user: img.user.name,
            link: img.links.html,
        }));
    } catch (error) {
        console.error("Unsplash Search Error:", error);
        return [];
    }
};
