"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import {
    Network,
    AtSign,
    Fingerprint,
    Dna,
    Hourglass,
    Terminal,
    AlertTriangle,
    ChevronRight,
    ArrowLeft,
    CheckCircle
} from 'lucide-react';
import Logo from '@/components/Logo';

export default function SignUp() {
    const router = useRouter();
    const [step, setStep] = useState(1); // 1: Auth, 2: Profile Setup
    const [signupMethod, setSignupMethod] = useState<'social' | 'email'>('social');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [gender, setGender] = useState('O');
    const [age, setAge] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [agreedToTerms, setAgreedToTerms] = useState(false);

    const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
    const fbAppId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || "";

    useEffect(() => {
        const existingUser = localStorage.getItem('user');
        if (existingUser) {
            try {
                const parsed = JSON.parse(existingUser);
                if (parsed?.username) {
                    router.replace('/dashboard');
                }
            } catch {}
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


    const handleAuthSuccess = (data: any) => {
        localStorage.setItem('user', JSON.stringify(data.user));
        if (data.access) localStorage.setItem('access_token', data.access);
        if (data.refresh) localStorage.setItem('refresh_token', data.refresh);

        if (data.user.is_new_user) {
            setStep(2);
            setName(data.user.username || '');
        } else {
            window.location.href = '/dashboard';
        }
    };

    const handleGoogleSuccess = async (credentialResponse: any) => {
        setIsSubmitting(true);
        setErrorMsg('');
        try {
            const data = await fetchApi('/users/google-login/', {
                method: 'POST',
                body: JSON.stringify({ id_token: credentialResponse.credential })
            });
            handleAuthSuccess(data);
        } catch (error: any) {
            console.error(error);
            setErrorMsg("Google authentication failed. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleFacebookLogin = () => {
        if (!(window as any).FB) {
            setErrorMsg("Facebook SDK not loaded yet. Please try again in a moment.");
            return;
        }
        setIsSubmitting(true);
        (window as any).FB.login((response: any) => {
            if (response.authResponse) {
                const accessToken = response.authResponse.accessToken;
                verifyFacebookToken(accessToken);
            } else {
                setIsSubmitting(false);
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
            handleAuthSuccess(data);
        } catch (error) {
            console.error(error);
            setErrorMsg("Facebook login failed. Please try again.");
            setIsSubmitting(false);
        }
    };

    const handleEmailContinue = (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) {
            setErrorMsg("Email and password are required.");
            return;
        }
        if (password.length < 8) {
            setErrorMsg("Password must be at least 8 characters long.");
            return;
        }
        setSignupMethod('email');
        setStep(2);
        setErrorMsg('');
    };

    const handleProfileHydration = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        setIsSubmitting(true);

        try {
            if (signupMethod === 'email') {
                // Register via standard endpoint
                const data = await fetchApi('/users/register/', {
                    method: 'POST',
                    body: JSON.stringify({
                        email,
                        password,
                        username: name,
                        gender,
                        age: age ? parseInt(age) : 18
                    })
                });
                
                // Store tokens
                localStorage.setItem('user', JSON.stringify(data.user));
                if (data.access) localStorage.setItem('access_token', data.access);
                if (data.refresh) localStorage.setItem('refresh_token', data.refresh);
                
                router.push('/onboarding');
            } else {
                // Update profile for social logins
                const data = await fetchApi('/users/profile/', {
                    method: 'PATCH',
                    body: JSON.stringify({
                        user: { username: name },
                        gender: gender,
                        age: age ? parseInt(age) : 18
                    })
                });

                // Update local user data
                const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
                localStorage.setItem('user', JSON.stringify({ ...currentUser, ...data }));

                router.push('/onboarding');
            }
        } catch (error: any) {
            setErrorMsg(error?.message || "Registration failed. Please try a different username or email.");
            setIsSubmitting(false);
        }
    };

    return (
        <GoogleOAuthProvider clientId={googleClientId}>
            <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-[#dcedec] via-[#f5f3ed] to-[#fadac0] text-slate-900 p-4 font-sans">
                
                {/* Ambient Background Glows */}
                <div className="absolute top-[10%] left-[20%] w-[600px] h-[600px] bg-white/60 blur-[150px] rounded-full mix-blend-overlay pointer-events-none" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-cyan-100/50 blur-[120px] rounded-full mix-blend-overlay pointer-events-none" />

                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="w-full max-w-xl p-6 sm:p-10 relative z-20 bg-white/70 backdrop-blur-2xl border border-white/80 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.08)] rounded-[32px]"
                >
                    <AnimatePresence mode="wait">
                        {step === 1 ? (
                            <motion.div
                                key="step-1"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="space-y-8"
                            >
                                {/* Branding & Header */}
                                <div className="flex flex-col items-center relative">
                                    <button
                                        type="button"
                                        onClick={() => router.push('/login')}
                                        className="absolute left-0 top-0 text-slate-400 hover:text-slate-600 transition-colors p-2"
                                        title="Return to Login"
                                    >
                                        <ArrowLeft className="w-5 h-5" />
                                    </button>
                                    <div className="scale-100 mb-2">
                                        <Logo />
                                    </div>
                                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight mt-4 text-center">Create Your Account</h1>
                                    <p className="text-sm font-medium text-slate-500 mt-1 text-center">Verification is required for a high-trust network</p>
                                </div>

                                {/* Terms and Conditions */}
                                <div className="w-full max-w-[320px] flex flex-col gap-3 mx-auto">
                                    <div className="bg-white/60 border border-slate-200 rounded-xl p-4 h-[160px] overflow-y-auto text-[11px] text-slate-600 space-y-4 shadow-inner custom-scrollbar">
                                        <div>
                                            <h4 className="font-bold text-slate-800 text-[12px] mb-1">Terms of Service</h4>
                                            <p className="mb-2">By accessing or using this website, you agree to be bound by these Terms.</p>
                                            <ul className="space-y-1.5">
                                                <li><strong>1. User Responsibility:</strong> Users are solely responsible for their actions, behavior, and interactions with other users both online and offline.</li>
                                                <li><strong>2. No Background Verification:</strong> We do not verify the identity, background, or intentions of any user. You agree to interact with others at your own risk.</li>
                                                <li><strong>3. Platform Role:</strong> This website acts only as a platform to connect individuals. We do not participate in, control, or take responsibility for any interactions, meetings, or agreements between users.</li>
                                                <li><strong>4. Prohibited Activities:</strong> Users must not engage in illegal, harmful, abusive, fraudulent, or misleading activities.</li>
                                                <li><strong>5. Content Responsibility:</strong> Users are responsible for any content they post. We are not liable for user-generated content.</li>
                                                <li><strong>6. Limitation of Liability:</strong> We are not liable for any damages, losses, injuries, or disputes arising from use of this platform.</li>
                                                <li><strong>7. Termination:</strong> We reserve the right to suspend or terminate any account at our discretion.</li>
                                                <li><strong>8. Acceptance:</strong> By using this website, you confirm that you understand and accept these terms.</li>
                                            </ul>
                                        </div>

                                        <div>
                                            <h4 className="font-bold text-slate-800 text-[12px] mb-1">Privacy Policy</h4>
                                            <p className="mb-2">We respect your privacy and are committed to protecting your personal data.</p>
                                            <ul className="space-y-1.5">
                                                <li><strong>1. Information We Collect:</strong> We may collect basic information such as name, email, and usage data.</li>
                                                <li><strong>2. How We Use Information:</strong> To provide and improve our services, and to ensure platform safety.</li>
                                                <li><strong>3. No Guarantee of Security:</strong> While we take reasonable measures, we cannot guarantee complete data security.</li>
                                                <li><strong>4. Third-Party Sharing:</strong> We do not sell your data but may share it if required by law.</li>
                                                <li><strong>5. User Responsibility:</strong> Users should not share sensitive personal information with others on the platform.</li>
                                                <li><strong>6. Consent:</strong> By using the website, you agree to this policy.</li>
                                            </ul>
                                        </div>

                                        <div>
                                            <h4 className="font-bold text-slate-800 text-[12px] mb-1">Disclaimer</h4>
                                            <p className="mb-2">This platform is provided "as is" without any warranties.</p>
                                            <ul className="list-disc pl-4 space-y-1">
                                                <li>We do not guarantee the accuracy, honesty, or intentions of users.</li>
                                                <li>We are not responsible for any offline meetings or outcomes.</li>
                                                <li>Users interact at their own risk.</li>
                                                <li>We are not liable for any harm, loss, fraud, or damages.</li>
                                            </ul>
                                            <p className="mt-2 font-semibold">Use this platform responsibly.</p>
                                        </div>

                                        <div>
                                            <h4 className="font-bold text-slate-800 text-[12px] mb-1">Safety Notice</h4>
                                            <ul className="list-disc pl-4 space-y-1 mb-2">
                                                <li>Always meet in public places.</li>
                                                <li>Do not share financial or sensitive personal information.</li>
                                                <li>Report suspicious users immediately.</li>
                                            </ul>
                                            <p className="font-semibold text-red-500/80">We are not responsible for user behavior or actions.</p>
                                        </div>

                                        <div>
                                            <h4 className="font-bold text-slate-800 text-[12px] mb-1">Community Guidelines</h4>
                                            <ul className="list-disc pl-4 space-y-1 mb-2">
                                                <li>Be respectful and honest.</li>
                                                <li>No harassment, hate speech, or abuse.</li>
                                                <li>No scams or fake profiles.</li>
                                                <li>No illegal activities.</li>
                                            </ul>
                                            <p className="font-semibold text-red-500/80">Violation may result in account suspension.</p>
                                        </div>
                                    </div>
                                    
                                    <label className="flex items-start gap-3 cursor-pointer group mb-2">
                                        <div className="relative flex items-center justify-center mt-0.5">
                                            <input 
                                                type="checkbox" 
                                                checked={agreedToTerms} 
                                                onChange={(e) => {
                                                    setAgreedToTerms(e.target.checked);
                                                    if (e.target.checked) setErrorMsg('');
                                                }} 
                                                className="peer appearance-none w-5 h-5 border-2 border-slate-300 rounded bg-white checked:bg-slate-900 checked:border-slate-900 transition-all cursor-pointer"
                                            />
                                            <CheckCircle className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" strokeWidth={3} />
                                        </div>
                                        <span className="text-[12px] text-slate-600 font-medium leading-tight group-hover:text-slate-800 transition-colors">
                                            I have read and agree to the Terms of Service, Privacy Policy, Disclaimer, Safety Notice, and Community Guidelines.
                                        </span>
                                    </label>
                                </div>

                                {/* Social Signup Group */}
                                <div className={`flex flex-col gap-4 items-center transition-all duration-300 relative ${!agreedToTerms ? 'opacity-50 grayscale' : ''}`}>
                                    {!agreedToTerms && <div className="absolute inset-0 z-10 cursor-not-allowed" onClick={() => setErrorMsg("Please agree to the terms first.")} />}
                                    <div className="w-full flex justify-center max-w-[320px]">
                                        <GoogleLogin
                                            onSuccess={handleGoogleSuccess}
                                            onError={() => {
                                                setErrorMsg("Google Authentication failed. Please try again.");
                                            }}
                                            theme="outline"
                                            shape="pill"
                                            text="signup_with"
                                        />
                                    </div>
                                    
                                    <button
                                        onClick={handleFacebookLogin}
                                        disabled={isSubmitting || !agreedToTerms}
                                        className="flex items-center justify-center gap-3 w-full max-w-[320px] bg-white border border-slate-200 py-2.5 rounded-full hover:bg-slate-50 transition-all font-medium text-sm text-slate-700 shadow-sm"
                                    >
                                        <svg className="w-5 h-5 text-[#1877F2]" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                                        </svg>
                                        Signup with Facebook
                                    </button>
                                    
                                    <div className="w-full max-w-[320px] flex items-center gap-4 my-2">
                                        <div className="h-px bg-slate-200 flex-1" />
                                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">or</span>
                                        <div className="h-px bg-slate-200 flex-1" />
                                    </div>

                                    <form onSubmit={handleEmailContinue} className="w-full max-w-[320px] space-y-4">
                                        <div className="space-y-1.5 group">
                                            <div className="relative">
                                                <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                                <input
                                                    type="email"
                                                    value={email}
                                                    onChange={(e) => setEmail(e.target.value)}
                                                    className="w-full bg-white border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-[14px] font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-400 transition-all"
                                                    placeholder="Corporate or personal email"
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-1.5 group">
                                            <div className="relative">
                                                <Fingerprint className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                                <input
                                                    type="password"
                                                    value={password}
                                                    onChange={(e) => setPassword(e.target.value)}
                                                    className="w-full bg-white border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-[14px] font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-400 transition-all"
                                                    placeholder="Secure password"
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={!agreedToTerms}
                                            className={`w-full text-white rounded-xl py-3 text-[14px] font-bold tracking-wide transition-all ${!agreedToTerms ? 'bg-slate-400 cursor-not-allowed' : 'bg-slate-900 hover:bg-slate-800'}`}
                                        >
                                            Continue with Email
                                        </button>
                                    </form>
                                </div>

                                {errorMsg && (
                                    <div className="bg-red-50/50 border border-red-100 rounded-xl p-4 flex items-start gap-3 text-red-600 text-[11px] font-semibold">
                                        <Terminal className="w-4 h-4 shrink-0" />
                                        <span>{errorMsg}</span>
                                    </div>
                                )}

                                <div className="pt-4 text-center">
                                    <p className="text-[12px] text-slate-400 font-medium">
                                        By signing up, you agree to our terms of verified discovery.
                                    </p>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="step-2"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="space-y-8"
                            >
                                <div className="flex flex-col items-center">
                                    <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                                        <CheckCircle className="w-7 h-7" />
                                    </div>
                                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Identity Verified</h1>
                                    <p className="text-sm font-medium text-slate-500 mt-1">Now, let's personalize your network profile</p>
                                </div>

                                <form onSubmit={handleProfileHydration} className="space-y-6">
                                    {/* Username Input */}
                                    <div className="space-y-2 group">
                                        <label className="text-[13px] font-semibold text-slate-600 flex items-center justify-between">
                                            <span>Customize Username</span>
                                            <Network className="w-3 h-3 opacity-50" />
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                className="w-full bg-white/60 border border-white shadow-inner rounded-xl px-4 py-3.5 text-[15px] font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-300 focus:bg-white transition-all transition-all"
                                                placeholder="Choose your handle"
                                                required
                                            />
                                            <p className="text-[10px] text-slate-400 mt-1.5 pl-1 italic">You can keep the auto-generated handle or create a new one.</p>
                                        </div>
                                    </div>

                                    {/* Demographics Row */}
                                    <div className="grid grid-cols-2 gap-4">
                                        {/* Gender */}
                                        <div className="space-y-2 group">
                                            <label className="text-[13px] font-semibold text-slate-600 flex items-center justify-between">
                                                <span>Gender</span>
                                                <Dna className="w-3 h-3 opacity-50" />
                                            </label>
                                            <div className="relative">
                                                <select
                                                    value={gender}
                                                    onChange={(e) => setGender(e.target.value)}
                                                    className="w-full bg-white/60 border border-white shadow-inner rounded-xl px-4 py-3.5 text-[15px] font-medium text-slate-800 focus:outline-none focus:border-slate-300 focus:bg-white transition-all appearance-none cursor-pointer"
                                                >
                                                    <option value="M">MALE</option>
                                                    <option value="F">FEMALE</option>
                                                    <option value="O">OTHER</option>
                                                </select>
                                            </div>
                                        </div>

                                        {/* Age */}
                                        <div className="space-y-2 group">
                                            <label className="text-[13px] font-semibold text-slate-600 flex items-center justify-between">
                                                <span>Age</span>
                                                <Hourglass className="w-3 h-3 opacity-50" />
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    min="18"
                                                    max="100"
                                                    value={age}
                                                    onChange={(e) => setAge(e.target.value)}
                                                    className="w-full bg-white/60 border border-white shadow-inner rounded-xl px-4 py-3.5 text-[15px] font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-300 focus:bg-white transition-all"
                                                    placeholder="18"
                                                    required
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Compliance Section */}
                                    <div className="bg-slate-50/50 rounded-2xl p-6 border border-slate-100 flex items-start gap-4">
                                        <input
                                            type="checkbox"
                                            required
                                            className="mt-1 w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500 cursor-pointer"
                                        />
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Safety Agreement</span>
                                            </div>
                                            <p className="text-[11px] leading-relaxed text-slate-500 font-medium font-sans">
                                                I agree to use Glysmork for high-trust connections only. I will not engage in harassment or broadcast explicit content.
                                            </p>
                                        </div>
                                    </div>

                                    {/* Submit Button */}
                                    <div className="pt-2">
                                        <button
                                            type="submit"
                                            disabled={isSubmitting}
                                            className={`relative w-full overflow-hidden rounded-full border border-slate-800 bg-slate-900 py-4 font-bold text-[15px] text-white transition-all hover:scale-[1.02] hover:shadow-[0_10px_30px_rgba(15,23,42,0.15)] focus:outline-none ${isSubmitting ? 'opacity-70 scale-95 cursor-wait' : ''}`}
                                        >
                                            <span className="relative z-10 flex items-center justify-center gap-2">
                                                {isSubmitting ? 'SAVING PROFILE...' : (
                                                    <>
                                                        Initialize Matching
                                                        <ChevronRight className="w-4 h-4" />
                                                    </>
                                                )}
                                            </span>
                                        </button>
                                    </div>
                                    {errorMsg && (
                                        <div className="text-red-500 text-[11px] font-semibold text-center mt-2">
                                            {errorMsg}
                                        </div>
                                    )}
                                </form>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </div>
        </GoogleOAuthProvider>
    );
}
