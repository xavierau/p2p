import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';

interface NavbarProps {
  onMenuClick: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ onMenuClick }) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <nav className="border-b bg-background py-4">
            <div className="container flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={onMenuClick} className="md:hidden">
                        <Menu />
                    </Button>
                    <Link to="/" className="text-2xl font-bold text-foreground">
                        PayManage
                    </Link>
                </div>
                <div className="hidden md:flex items-center gap-4">
                    {user ? (
                        <>
                            <Link to="/dashboard" className="text-muted-foreground hover:text-foreground">Dashboard</Link>
                            <Link to="/invoices" className="text-muted-foreground hover:text-foreground">Invoices</Link>
                            <Link to="/vendors" className="text-muted-foreground hover:text-foreground">Vendors</Link>
                            <Link to="/items" className="text-muted-foreground hover:text-foreground">Items</Link>
                            <Link to="/purchase-orders" className="text-muted-foreground hover:text-foreground">POs</Link>
                            <Link to="/profile" className="text-muted-foreground hover:text-foreground">Profile</Link>
                            <Link to="/settings" className="text-muted-foreground hover:text-foreground">Settings</Link>
                            <span className="font-semibold text-foreground">{user.name}</span>
                            <Button variant="secondary" onClick={handleLogout}>Logout</Button>
                        </>
                    ) : (
                        <>
                            <Link to="/login"><Button variant="ghost">Login</Button></Link>
                            <Link to="/register"><Button>Register</Button></Link>
                        </>
                    )}
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
