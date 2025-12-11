import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import Page from './components/Page';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import Dashboard from './pages/Dashboard';
import InvoiceList from './pages/InvoiceList';
import CreateInvoice from './pages/CreateInvoice';
import InvoiceDetail from './pages/InvoiceDetail';
import VendorList from './pages/VendorList';
import VendorDetail from './pages/VendorDetail';
import ItemList from './pages/ItemList';
import ItemDetail from './pages/ItemDetail';
import PurchaseOrderList from './pages/PurchaseOrderList';
import PurchaseOrderDetail from './pages/PurchaseOrderDetail';
import DeliveryNotes from './pages/DeliveryNotes';
import DeliveryNoteDetailPage from './pages/DeliveryNoteDetailPage';
import CreateDeliveryNote from './pages/CreateDeliveryNote';
import DepartmentList from './pages/DepartmentList';
import CostCenterList from './pages/CostCenterList';
import BranchList from './pages/BranchList';
import ProfilePage from './pages/ProfilePage';
import SettingsPage from './pages/Settings';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import FlaggedInvoicesPage from './pages/FlaggedInvoicesPage';
import ValidationRulesPage from './pages/ValidationRulesPage';
import AnalyticsDashboard from './pages/AnalyticsDashboard';
import { initializeCsrf } from './lib/api';

function App() {
    // Initialize CSRF protection on app mount
    useEffect(() => {
        initializeCsrf();
    }, []);
    return (
        <AuthProvider>
            <Router>
                <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                    <Route
                        path="/*"
                        element={
                            <ProtectedRoute>
                                <Layout>
                                    <Routes>
                                        <Route path="/" element={<Page title="Dashboard"><Dashboard /></Page>} />
                                        <Route path="/dashboard" element={<Page title="Dashboard"><Dashboard /></Page>} />
                                        <Route path="/invoices" element={<Page title="Invoices"><InvoiceList /></Page>} />
                                        <Route path="/invoices/new" element={<Page title="Create Invoice"><CreateInvoice /></Page>} />
                                        <Route path="/invoices/:id" element={<Page title="Invoice Details"><InvoiceDetail /></Page>} />
                                        <Route path="/validations/flagged-invoices" element={<Page title="Flagged Invoices"><FlaggedInvoicesPage /></Page>} />
                                        <Route path="/validations/rules" element={<Page title="Validation Rules"><ValidationRulesPage /></Page>} />
                                        <Route path="/vendors" element={<Page title="Vendors"><VendorList /></Page>} />
                                        <Route path="/vendors/:id" element={<Page title="Vendor Details"><VendorDetail /></Page>} />
                                        <Route path="/items" element={<Page title="Items"><ItemList /></Page>} />
                                        <Route path="/items/:id" element={<Page title="Item Details"><ItemDetail /></Page>} />
                                        <Route path="/purchase-orders" element={<Page title="Purchase Orders"><PurchaseOrderList /></Page>} />
                                        <Route path="/purchase-orders/:id" element={<Page title="Purchase Order Details"><PurchaseOrderDetail /></Page>} />
                                        <Route path="/delivery-notes" element={<Page title="Delivery Notes"><DeliveryNotes /></Page>} />
                                        <Route path="/delivery-notes/new" element={<Page title="Create Delivery Note"><CreateDeliveryNote /></Page>} />
                                        <Route path="/delivery-notes/:id" element={<Page title="Delivery Note Details"><DeliveryNoteDetailPage /></Page>} />
                                        <Route path="/departments" element={<Page title="Departments"><DepartmentList /></Page>} />
                                        <Route path="/cost-centers" element={<Page title="Cost Centers"><CostCenterList /></Page>} />
                                        <Route path="/branches" element={<Page title="Branches"><BranchList /></Page>} />
                                        <Route path="/analytics" element={<Page title="Analytics Dashboard"><AnalyticsDashboard /></Page>} />
                                        <Route path="/profile" element={<Page title="Profile"><ProfilePage /></Page>} />
                                        <Route path="/settings" element={<Page title="Settings"><SettingsPage /></Page>} />
                                    </Routes>
                                </Layout>
                            </ProtectedRoute>
                        }
                    />
                </Routes>
            </Router>
        </AuthProvider>
    );
}

export default App;
