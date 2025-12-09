import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authService, ForgotPasswordData } from '@/services/authService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';

const ForgotPasswordPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const data: ForgotPasswordData = { email };
            await authService.forgotPassword(data);
            setMessage('If an account exists with this email, you will receive a password reset link.');
            setError('');
        } catch (err: any) {
            setError('Failed to process request.');
        }
    };

    return (
        <div className="flex justify-center items-center min-h-[60vh]">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>Forgot Password</CardTitle>
                    <CardDescription>Enter your email to reset your password.</CardDescription>
                </CardHeader>
                <CardContent>
                    {message && <div className="text-green-600 mb-4 text-sm">{message}</div>}
                    {error && <div className="text-destructive mb-4 text-sm">{error}</div>}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <Button type="submit" className="w-full">Send Reset Link</Button>
                    </form>
                </CardContent>
                <CardFooter className="justify-center">
                    <div className="text-sm text-muted-foreground">
                        Remember your password? <Link to="/login" className="text-primary hover:underline">Login</Link>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
};

export default ForgotPasswordPage;
