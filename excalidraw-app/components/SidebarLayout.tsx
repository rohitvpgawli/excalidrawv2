import React from "react";

interface SidebarLayoutProps {
    children: React.ReactNode;
}

export const SidebarLayout: React.FC<SidebarLayoutProps> = ({ children }) => {
    return (
        <>
            {children}
        </>
    );
};
