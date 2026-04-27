"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';
import { motion } from 'framer-motion';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { Network, Fingerprint, ChevronRight } from 'lucide-react';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
    const fbAppId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || "";

    useEffect(() => {
        const existingUser = localStorage.getItem('user');
        if (existingUser) {
            try {
                const parsed = JSON.parse(existingUser);
                if (parsed?.username) {
                    router.replace('/dashboard');
                    return;
                }
            } catch {}
            localStorage.removeItem('user');
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
        }

        // Initialize Facebook SDK
        (window as any).fbAsyncInit = function() {
            (window as any).FB.init({
                appId      : fbAppId,
                cookie     : true,
                xfbml      : true,
                version    : 'v18.0'
            });
        };
        (function(d: Document, s: string, id: string) {
            var js, fjs = d.getElementsByTagName(s)[0];
            if (d.getElementById(id)) return;
            js = d.createElement(s) as HTMLScriptElement; js.id = id;
            js.src = "https://connect.facebook.net/en_US/sdk.js";
            if (fjs && fjs.parentNode) {
                fjs.parentNode.insertBefore(js, fjs);
            }
        }(document, 'script', 'facebook-jssdk'));
    }, [router, fbAppId]);


    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const data = await fetchApi('/users/login/', {
                method: 'POST',
                body: JSON.stringify({ username, password })
            });
            localStorage.setItem('user', JSON.stringify(data.user));
            if (data.access) localStorage.setItem('access_token', data.access);
            if (data.refresh) localStorage.setItem('refresh_token', data.refresh);
            window.location.href = '/dashboard';
        } catch (error) {
            console.error(error);
            alert("Login failed. Please check your credentials.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSuccess = async (credentialResponse: any) => {
        setIsLoading(true);
        try {
            const data = await fetchApi('/users/google-login/', {
                method: 'POST',
                body: JSON.stringify({ id_token: credentialResponse.credential })
            });
            localStorage.setItem('user', JSON.stringify(data.user));
            if (data.access) localStorage.setItem('access_token', data.access);
            if (data.refresh) localStorage.setItem('refresh_token', data.refresh);
            window.location.href = '/dashboard';
        } catch (error) {
            console.error(error);
            alert("Google login failed. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleFacebookLogin = () => {
        if (!(window as any).FB) {
            alert("Facebook SDK not loaded yet. Please try again in a moment.");
            return;
        }
        setIsLoading(true);
        (window as any).FB.login((response: any) => {
            if (response.authResponse) {
                const accessToken = response.authResponse.accessToken;
                verifyFacebookToken(accessToken);
            } else {
                setIsLoading(false);
                console.log('User cancelled login or did not fully authorize.');
            }
        }, { scope: 'public_profile,email' });
    };

    const verifyFacebookToken = async (accessToken: string) => {
        try {
            const data = await fetchApi('/users/facebook-login/', {
                method: 'POST',
                body: JSON.stringify({ access_token: accessToken })
            });
            localStorage.setItem('user', JSON.stringify(data.user));
            if (data.access) localStorage.setItem('access_token', data.access);
            if (data.refresh) localStorage.setItem('refresh_token', data.refresh);
            window.location.href = '/dashboard';
        } catch (error) {
            console.error(error);
            alert("Facebook login failed. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <GoogleOAuthProvider clientId={googleClientId}>
            <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-[#dcedec] via-[#f5f3ed] to-[#fadac0] text-slate-900 selection:bg-cyan-500/30 font-sans">
                
                {/* Ambient Background Glows */}
                <div className="absolute top-[10%] left-[20%] w-[600px] h-[600px] bg-white/60 blur-[150px] rounded-full mix-blend-overlay pointer-events-none" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-cyan-100/50 blur-[120px] rounded-full mix-blend-overlay pointer-events-none" />

                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="w-full max-w-md p-6 sm:p-10 relative z-20 bg-white/70 backdrop-blur-2xl border border-white/80 rounded-[32px] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.08)]"
                >
                    {/* Branding Header */}
                    <div className="flex flex-col items-center mb-8 mt-2">
                        <div className="flex items-center gap-2 text-[32px] font-bold tracking-tight text-slate-800 mb-2">
                            Glysmork
                            <Network className="w-7 h-7 text-slate-500" />
                        </div>
                        <p className="text-sm font-medium text-slate-500">Welcome back to the network</p>
                    </div>

                    {/* Social Login Section */}
                    <div className="mb-8 flex flex-col gap-4 items-center">
                        <div className="w-full flex justify-center max-w-[320px]">
                            <GoogleLogin
                                onSuccess={handleGoogleSuccess}
                                onError={() => {
                                    console.error('Google Login Error: Token retrieval failed.');
                                }}
                                theme="outline"
                                shape="pill"
                            />
                        </div>
                        
                        <button
                            onClick={handleFacebookLogin}
                            disabled={isLoading}
                            className="flex items-center justify-center gap-3 w-full max-w-[320px] bg-white border border-slate-200 py-2.5 rounded-full hover:bg-slate-50 transition-all font-medium text-sm text-slate-700 shadow-sm"
                        >
                            <svg className="w-5 h-5 text-[#1877F2]" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                            </svg>
                            Continue with Facebook
                        </button>

                        <div className="mt-4 flex items-center w-full gap-4">
                            <div className="h-px bg-slate-200 flex-1" />
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">or continue with email</span>
                            <div className="h-px bg-slate-200 flex-1" />
                        </div>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-5">
                        {/* Username Input */}
                        <div className="space-y-1.5 group">
                            <label className="text-[13px] font-semibold text-slate-600 pl-1 flex items-center gap-2">
                                <Network className="w-3.5 h-3.5 opacity-70" />
                                Username
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full bg-white/60 border border-white shadow-inner rounded-xl px-4 py-3.5 text-[15px] font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-300 focus:bg-white transition-all"
                                    placeholder="Enter your username"
                                    required
                                />
                            </div>
                        </div>

                        {/* Password Input */}
                        <div className="space-y-1.5 group">
                            <label className="text-[13px] font-semibold text-slate-600 pl-1 flex items-center gap-2">
                                <Fingerprint className="w-3.5 h-3.5 opacity-70" />
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-white/60 border border-white shadow-inner rounded-xl px-4 py-3.5 text-[15px] font-medium tracking-widest text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-300 focus:bg-white transition-all"
                                    placeholder="••••••••••••"
                                    required
                                />
                            </div>
                        </div>

                        {/* Submit Button */}
                        <div className="pt-4">
                            <button
                                type="submit"
                                disabled={isLoading}
                                className={`relative w-full overflow-hidden rounded-full bg-slate-900 border border-slate-800 py-4 font-semibold text-[15px] text-white transition-all hover:scale-[1.02] hover:shadow-[0_10px_30px_rgba(15,23,42,0.15)] focus:outline-none ${isLoading ? 'opacity-70 scale-95 hover:scale-95 cursor-wait' : ''}`}
                            >
                                <span className="relative z-10 flex items-center justify-center gap-2">
                                    {isLoading ? 'Authenticating...' : (
                                        <>
                                            Sign In
                                            <ChevronRight className="w-4 h-4" />
                                        </>
                                    )}
                                </span>
                            </button>
                        </div>
                    </form>

                    {/* Footer Links */}
                    <div className="mt-8 flex flex-col items-center gap-4 text-[13px] font-medium text-slate-500">
                        <p>
                            New here?{' '}
                            <button
                                onClick={() => router.push('/signup')}
                                className="text-slate-900 font-bold transition-colors hover:text-slate-700 underline underline-offset-4 focus:outline-none"
                            >
                                Create an Account
                            </button>
                        </p>
                    </div>
                </motion.div>
            </div>
        </GoogleOAuthProvider>
    );
}
