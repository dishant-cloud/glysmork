"use client";

import Logo from '@/components/Logo';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPolicy() {
    return (
        <div className="min-h-screen bg-white text-slate-700">
            <div className="max-w-3xl mx-auto px-6 py-12">
                <div className="flex items-center gap-4 mb-12">
                    <Link href="/" className="p-2 rounded-full hover:bg-slate-100 transition-colors">
                        <ArrowLeft className="w-5 h-5 text-slate-500" />
                    </Link>
                    <Logo size="md" />
                </div>

                <h1 className="text-4xl font-bold text-slate-900 mb-2">Privacy Policy</h1>
                <p className="text-sm text-slate-400 mb-10 font-sans text-[13px] font-medium">Last updated: May 1, 2026</p>

                <div className="space-y-8 leading-relaxed text-sm text-slate-600">
                    <section>
                        <h2 className="text-xl font-semibold text-slate-900 mb-3">1. Information We Collect</h2>
                        <p className="mb-3">When you use Glysmork, we collect the following types of information:</p>
                        <ul className="list-disc ml-6 space-y-2">
                            <li><strong className="text-slate-800">Account Information:</strong> Email address, password (hashed), username, and authentication tokens from third-party providers (Google, Facebook).</li>
                            <li><strong className="text-slate-800">Profile Data:</strong> Answers to the onboarding questionnaire, bio, interests, expertise areas, and location data (country/state/geohash).</li>
                            <li><strong className="text-slate-800">Usage Data:</strong> Timestamps of your logins, session durations, search queries, and match history.</li>
                            <li><strong className="text-slate-800">Communications:</strong> Chat transcripts, audio/video call metadata (duration, connection quality, but NOT the audio/video content itself), and support requests.</li>
                            <li><strong className="text-slate-800">Device Information:</strong> Device fingerprints, IP addresses, and Firebase Cloud Messaging tokens for push notifications.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-slate-900 mb-3">2. How We Use Your Information</h2>
                        <p className="mb-3">Your data is primarily used to facilitate the core matching functionality of Glysmork:</p>
                        <ul className="list-disc ml-6 space-y-2">
                            <li>To create your AI psychological profile, calculate connection compatibility, and generate mathematical vector embeddings of your interests.</li>
                            <li>To dynamically adjust your <strong className="text-slate-800">Trust Score</strong> based on platform engagement, age of account, and negative feedback (Blocks/Reports).</li>
                            <li>To connect you with other users via text chat and WebRTC-based audio/video calls.</li>
                            <li>To enforce our Terms of Service, prevent fraud, and maintain a safe community through moderation.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-slate-900 mb-3">3. Data Sharing and Third-Party Services</h2>
                        <p className="mb-3">Glysmork does not sell your personal data. However, we integrate with third-party services to provide our core features:</p>
                        <ul className="list-disc ml-6 space-y-2">
                            <li><strong className="text-slate-800">AI Inference (Groq/Gemini):</strong> Your onboarding answers and search intents may be sent to third-party Language Models for summarization and matching. This data is anonymized where possible.</li>
                            <li><strong className="text-slate-800">Payment Processing (Razorpay):</strong> Subscription billing is handled securely by Razorpay. Glysmork does not store your credit card information.</li>
                            <li><strong className="text-slate-800">Law Enforcement:</strong> We may disclose information if legally required to do so by a valid subpoena or court order.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-slate-900 mb-3">4. Data Security &amp; Limitations</h2>
                        <ul className="list-disc ml-6 space-y-2">
                            <li>We implement industry-standard security measures, including SSL encryption, secure WebSocket connections, API rate limiting, and protection against common vulnerabilities.</li>
                            <li><strong className="text-slate-800">No Absolute Security:</strong> While we strive to protect your personal data, no method of transmission over the Internet or electronic storage is 100% secure. We cannot guarantee absolute security against all malicious attacks, unauthorized access, or hardware failures.</li>
                            <li>In the event of a severe data breach or server compromise, Glysmork shall not be held legally or financially liable for any resulting damages, loss of privacy, or exposure of conversational data.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-slate-900 mb-3">5. Data Retention and Deletion</h2>
                        <p className="mb-3">You have the right to control your data:</p>
                        <ul className="list-disc ml-6 space-y-2">
                            <li>You can request account deletion at any time. Upon deletion, your profile, embeddings, and credentials are permanently removed from our active database.</li>
                            <li>Chat transcripts involving you may be retained if the other participant retains them, or if the conversation is subject to an active Trust &amp; Safety investigation (e.g., a pending Report).</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-slate-900 mb-3">6. Your Rights</h2>
                        <p>Depending on your jurisdiction (e.g., GDPR, CCPA), you may have the right to access, correct, or request the deletion of your personal data. Contact us at <span className="text-indigo-600 font-medium">privacy@glysmork.com</span> to exercise these rights.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-slate-900 mb-3">7. Changes to this Policy</h2>
                        <p>We may periodically update this Privacy Policy to reflect changes in our practices. We will notify users of significant changes via email or an in-app notification.</p>
                    </section>
                </div>

                <div className="mt-16 pt-8 border-t border-slate-200 text-center">
                    <Link href="/terms" className="text-indigo-600 hover:text-indigo-500 text-sm font-medium">Terms of Service</Link>
                    <span className="text-slate-300 mx-3">•</span>
                    <Link href="/wallet" className="text-indigo-600 hover:text-indigo-500 text-sm font-medium">Subscription Plans</Link>
                    <span className="text-slate-300 mx-3">•</span>
                    <Link href="/" className="text-slate-500 hover:text-slate-700 text-sm font-medium">Back to Home</Link>
                </div>
            </div>
        </div>
    );
}
