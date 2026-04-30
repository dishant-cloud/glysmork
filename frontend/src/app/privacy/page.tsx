"use client";

import Logo from '@/components/Logo';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPolicy() {
    return (
        <div className="min-h-screen bg-background text-gray-300">
            <div className="max-w-3xl mx-auto px-6 py-12">
                <div className="flex items-center gap-4 mb-12">
                    <Link href="/" className="p-2 rounded-full hover:bg-white/80 transition-colors">
                        <ArrowLeft className="w-5 h-5 text-gray-400" />
                    </Link>
                    <Logo size="md" />
                </div>

                <h1 className="text-4xl font-bold text-white mb-2">Privacy Policy</h1>
                <p className="text-sm text-gray-500 mb-10 font-sans text-[13px] font-medium">Last updated: May 1, 2026</p>

                <div className="space-y-8 leading-relaxed text-sm">
                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">1. Information We Collect</h2>
                        <p className="mb-3">When you use Glysmork, we collect the following types of information:</p>
                        <ul className="list-disc ml-6 space-y-2">
                            <li><strong className="text-white">Account Information:</strong> Email address, password (hashed), username, and authentication tokens from third-party providers (Google, Facebook).</li>
                            <li><strong className="text-white">Profile Data:</strong> Answers to the onboarding questionnaire, bio, interests, expertise areas, and location data (country/state/geohash).</li>
                            <li><strong className="text-white">Usage Data:</strong> Timestamps of your logins, session durations, search queries, and match history.</li>
                            <li><strong className="text-white">Communications:</strong> Chat transcripts, audio/video call metadata (duration, connection quality, but NOT the audio/video content itself), and support requests.</li>
                            <li><strong className="text-white">Device Information:</strong> Device fingerprints, IP addresses, and Firebase Cloud Messaging tokens for push notifications.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">2. How We Use Your Information</h2>
                        <p className="mb-3">Your data is primarily used to facilitate the core matching functionality of Glysmork:</p>
                        <ul className="list-disc ml-6 space-y-2">
                            <li>To create your AI psychological profile, calculate connection compatibility, and generate mathematical vector embeddings of your interests.</li>
                            <li>To dynamically adjust your <strong className="text-white">Trust Score</strong> based on platform engagement, age of account, and negative feedback (Blocks/Reports).</li>
                            <li>To connect you with other users via text chat and WebRTC-based audio/video calls.</li>
                            <li>To enforce our Terms of Service, prevent fraud, and maintain a safe community through automated moderation.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">3. Data Sharing and Third-Party Services</h2>
                        <p className="mb-3">Glysmork does not sell your personal data. However, we integrate with third-party services to provide our core features:</p>
                        <ul className="list-disc ml-6 space-y-2">
                            <li><strong className="text-white">AI Inference (Groq/LLMs):</strong> Your onboarding answers, search intents, and select chat context may be sent to third-party Language Models for summarization and matching. This data is anonymized where possible.</li>
                            <li><strong className="text-white">Payment Processing (Razorpay):</strong> Subscription billing is handled securely by Razorpay. Glysmork does not store your credit card information.</li>
                            <li><strong className="text-white">Image Generation (Pollinations.ai):</strong> Persona image generation relies on text prompts sent to Pollinations.</li>
                            <li><strong className="text-white">Law Enforcement:</strong> We may disclose information if legally required to do so by a valid subpoena or court order.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">4. Data Security</h2>
                        <p>We implement industry-standard security measures, including SSL encryption, secure WebSocket connections, API rate limiting, and protection against common vulnerabilities (e.g., XML injection, SQL injection). However, no system is entirely impenetrable, and we cannot guarantee absolute security of your data.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">5. Data Retention and Deletion</h2>
                        <p className="mb-3">You have the right to control your data:</p>
                        <ul className="list-disc ml-6 space-y-2">
                            <li>You can request account deletion at any time. Upon deletion, your profile, embeddings, and credentials are permanently removed from our active database.</li>
                            <li>Chat transcripts involving you may be retained if the other participant retains them, or if the conversation is subject to an active Trust & Safety investigation (e.g., a pending Report).</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">6. Your Rights</h2>
                        <p>Depending on your jurisdiction (e.g., GDPR, CCPA), you may have the right to access, correct, or request the deletion of your personal data. Contact us at <span className="text-purple-400">privacy@glysmork.com</span> to exercise these rights.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">7. Changes to this Policy</h2>
                        <p>We may periodically update this Privacy Policy to reflect changes in our practices. We will notify users of significant changes via email or an in-app notification.</p>
                    </section>
                </div>

                <div className="mt-16 pt-8 border-t border-slate-200/60 shadow-sm text-center">
                    <Link href="/terms" className="text-purple-400 hover:text-purple-300 text-sm">Terms of Service</Link>
                    <span className="text-gray-600 mx-3">•</span>
                    <Link href="/wallet" className="text-purple-400 hover:text-purple-300 text-sm">Subscription Plans</Link>
                    <span className="text-gray-600 mx-3">•</span>
                    <Link href="/" className="text-gray-500 hover:text-gray-400 text-sm">Back to Home</Link>
                </div>
            </div>
        </div>
    );
}
