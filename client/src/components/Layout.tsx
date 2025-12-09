import React, { useState } from 'react';
import Navbar from './Navbar';
import Drawer from './Drawer';

interface LayoutProps {
    children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <Navbar onMenuClick={() => setIsDrawerOpen(!isDrawerOpen)} />
            <Drawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
            <main style={{ flex: 1, padding: '2rem 0' }}>
                <div className="container">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default Layout;
