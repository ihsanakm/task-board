"use client";

import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { Button } from '../components/Button/Button';
import { Input } from '../components/Input/Input';
import styles from './login.module.css';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    // Email/password login (sign‑in)
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            if (error) throw error;
            if (data.user) {
                // Ensure a profile row exists for the user
                await supabase.from('profiles').upsert({ id: data.user.id, updated_at: new Date() });
            }
            router.push('/');
        } catch (err: any) {
            setError(err.message === 'Invalid login credentials'
                ? 'Check your email and password'
                : err.message);
        } finally {
            setLoading(false);
        }
    };
    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <div className={styles.header}>
                    <h1>Task Board Access</h1>
                    <p>Enter your credentials to manage your projects</p>
                </div>

                <form onSubmit={handleLogin} className={styles.form}>
                    <div className={styles.fieldGroup}>
                        <Input
                            label="Email Address"
                            type="email"
                            placeholder="name@company.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className={styles.fieldGroup}>
                        <Input
                            label="Password"
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={6}
                        />
                    </div>

                    {error && (
                        <div className={styles.errorText}>
                            {error}
                        </div>
                    )}

                    <Button type="submit" disabled={loading} fullWidth style={{ justifyContent: 'center', height: '48px', marginTop: '0.5rem' }}>
                        {loading ? 'Signing in...' : 'Sign In'}
                    </Button>
                </form>

                <div className={styles.footer}>
                    <div className={styles.guestSection}>
                        <p>No account yet? Please contact your admin.</p>
                        <a href="/guest" className={styles.guestLink}>Continue as Guest (Read-Only)</a>
                    </div>
                </div>
            </div>
        </div>
    );
}
