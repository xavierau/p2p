import React, { useEffect, useState } from 'react';
import { settingsService } from '@/services/settingsService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import { PanelLeft, PanelRight } from 'lucide-react';
import { McpTokenList } from '@/components/mcp-tokens/McpTokenList';

type Section = 'integrations' | 'users' | 'api-keys';

const SettingsPage: React.FC = () => {
    const [activeSection, setActiveSection] = useState<Section>('integrations');
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    return (
        <div>
            <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="mb-4"
            >
                {isSidebarCollapsed ? <PanelRight /> : <PanelLeft />}
            </Button>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {!isSidebarCollapsed && (
                    <div className="md:col-span-1">
                        <nav className="space-y-1">
                            <button
                                onClick={() => setActiveSection('integrations')}
                                className={cn(
                                    'w-full text-left px-3 py-2 rounded-md text-sm font-medium',
                                    activeSection === 'integrations' ? 'bg-muted' : 'hover:bg-muted/50'
                                )}
                            >
                                Integrations
                            </button>
                            <button
                                onClick={() => setActiveSection('users')}
                                className={cn(
                                    'w-full text-left px-3 py-2 rounded-md text-sm font-medium',
                                    activeSection === 'users' ? 'bg-muted' : 'hover:bg-muted/50'
                                )}
                            >
                                Users
                            </button>
                            <button
                                onClick={() => setActiveSection('api-keys')}
                                className={cn(
                                    'w-full text-left px-3 py-2 rounded-md text-sm font-medium',
                                    activeSection === 'api-keys' ? 'bg-muted' : 'hover:bg-muted/50'
                                )}
                            >
                                API Keys
                            </button>
                        </nav>
                    </div>
                )}
                <div className={cn(isSidebarCollapsed ? "md:col-span-4" : "md:col-span-3")}>
                    {activeSection === 'integrations' && <IntegrationsSection />}
                    {activeSection === 'users' && <UsersSection />}
                    {activeSection === 'api-keys' && <ApiKeysSection />}
                </div>
            </div>
        </div>
    );
};

const IntegrationsSection: React.FC = () => {
    const [enabled, setEnabled] = useState(false);
    const [clientId, setClientId] = useState('');
    const [clientSecret, setClientSecret] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const response = await settingsService.getIntegrationSettings('XERO');
            const { enabled: fetchedEnabled, config } = response as any; // Cast to any to access enabled and config
            setEnabled(fetchedEnabled);
            if (config) {
                const parsedConfig = JSON.parse(config);
                setClientId(parsedConfig.clientId || '');
                setClientSecret(parsedConfig.clientSecret || '');
            }
        } catch (error) {
            console.error('Failed to fetch settings', error);
        }
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const config = { clientId, clientSecret };
            await settingsService.updateIntegrationSettings('XERO', { enabled, config: JSON.stringify(config) });
            alert('Settings saved successfully');
        } catch (error) {
            console.error('Failed to save settings', error);
            alert('Failed to save settings');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Integrations</CardTitle>
                <CardDescription>Configure your integration settings.</CardDescription>
            </CardHeader>
            <CardContent>
                <Accordion type="single" collapsible>
                    <AccordionItem value="xero">
                        <AccordionTrigger>
                            <div className="flex flex-col items-start">
                                <Label>Xero</Label>
                                <CardDescription>Configure your Xero accounting integration settings.</CardDescription>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-4">
                            <div className="flex items-center space-x-2">
                                <Switch id="xero-enabled" checked={enabled} onCheckedChange={setEnabled} />
                                <Label htmlFor="xero-enabled">Enable Xero Integration</Label>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="client-id">Client ID</Label>
                                <Input
                                    id="client-id"
                                    value={clientId}
                                    onChange={(e) => setClientId(e.target.value)}
                                    placeholder="Enter your Xero Client ID"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="client-secret">Client Secret</Label>
                                <Input
                                    id="client-secret"
                                    type="password"
                                    value={clientSecret}
                                    onChange={(e) => setClientSecret(e.target.value)}
                                    placeholder="Enter your Xero Client Secret"
                                />
                            </div>

                            <Button onClick={handleSave} disabled={loading}>
                                {loading ? 'Saving...' : 'Save Settings'}
                            </Button>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </CardContent>
        </Card>
    );
}

const UsersSection: React.FC = () => {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Users</CardTitle>
                <CardDescription>Manage user access and permissions.</CardDescription>
            </CardHeader>
            <CardContent>
                <p>User management coming soon.</p>
            </CardContent>
        </Card>
    );
}

const ApiKeysSection: React.FC = () => {
    return <McpTokenList />;
}


export default SettingsPage;
