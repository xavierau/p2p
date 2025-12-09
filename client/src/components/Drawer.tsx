import React from 'react';
import { Link } from 'react-router-dom';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const Drawer: React.FC<DrawerProps> = ({ isOpen, onClose }) => {
  return (
    <div
      className={`fixed inset-y-0 left-0 z-30 w-64 bg-background border-r transform ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      } transition-transform duration-300 ease-in-out`}
    >
      <div className="p-4">
        <h2 className="text-2xl font-bold">PayManage</h2>
        <nav className="mt-8">
          <ul>
            <li>
              <Link to="/dashboard" className="block py-2" onClick={onClose}>
                Dashboard
              </Link>
            </li>
            <li>
              <Link to="/invoices" className="block py-2" onClick={onClose}>
                Invoices
              </Link>
            </li>
            <li>
              <Link to="/vendors" className="block py-2" onClick={onClose}>
                Vendors
              </Link>
            </li>
            <li>
              <Link to="/items" className="block py-2" onClick={onClose}>
                Items
              </Link>
            </li>
            <li>
              <Link to="/purchase-orders" className="block py-2" onClick={onClose}>
                Purchase Orders
              </Link>
            </li>
            <li>
              <Link to="/departments" className="block py-2" onClick={onClose}>
                Departments
              </Link>
            </li>
            <li>
              <Link to="/cost-centers" className="block py-2" onClick={onClose}>
                Cost Centers
              </Link>
            </li>
            <li>
              <Link to="/branches" className="block py-2" onClick={onClose}>
                Branches
              </Link>
            </li>
            <li>
              <Link to="/profile" className="block py-2" onClick={onClose}>
                Profile
              </Link>
            </li>
            <li>
              <Link to="/settings" className="block py-2" onClick={onClose}>
                Settings
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  );
};

export default Drawer;
