"use client";

import Logo from '@/components/Logo';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function TermsOfService() {
    return (
        <div className="min-h-screen bg-background text-gray-300">
            <div className="max-w-3xl mx-auto px-6 py-12">
                <div className="flex items-center gap-4 mb-12">
                    <Link href="/" className="p-2 rounded-full hover:bg-white/80 transition-colors">
                        <ArrowLeft className="w-5 h-5 text-gray-400" />
                    </Link>
                    <Logo size="md" />
                </div>

                <h1 className="text-4xl font-bold text-white mb-2">Terms of Service</h1>
                <p className="text-sm text-gray-500 mb-10 font-sans text-[13px] font-medium">Last updated: April 13, 2026</p>

                <div className="space-y-8 leading-relaxed text-sm">
                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">1. Acceptance of Terms</h2>
                        <p>By creating an account on Glysmork, you agree to these Terms of Service and our <Link href="/privacy" className="text-purple-400 hover:text-purple-300 underline">Privacy Policy</Link>. If you do not agree, do not use the platform.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">2. Description of Service</h2>
                        <p>Glysmork is a universal connection engine that uses artificial intelligence to analyze user profiles and match people based on intent queries. The platform enables users to find and connect with specific types of people for any purpose — conversations, mentorship, dating, networking, expertise-seeking, emotional support, or any other form of human connection. Certain features require a paid subscription.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">3. Account Requirements</h2>
                        <ul className="list-disc ml-6 space-y-2">
                            <li>You must be at least 18 years old to use Glysmork.</li>
                            <li>You must provide accurate information during the onboarding quiz. Deliberately providing false or misleading answers may result in account restrictions.</li>
                            <li>You are responsible for maintaining the security of your account credentials.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">4. Free Usage Limits & Quotas</h2>
                        <p className="mb-3">Free accounts are subject to the following daily usage limits, which reset at midnight UTC:</p>
                        <ul className="list-disc ml-6 space-y-2">
                            <li><strong className="text-white">AI/Intent-based Search:</strong> Up to 4 searches per day (combined). This limit applies to all searches that involve calling an external AI/LLM service, including onboarding-profile-aware searches.</li>
                            <li><strong className="text-white">Roulette Matching:</strong> Up to 20 random matches per day.</li>
                            <li>Once a limit is reached, the feature will be unavailable until the daily quota resets, unless you upgrade to a subscription plan.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">5. Subscription Plans & Billing</h2>
                        <p className="mb-3">Glysmork offers the following paid subscription tiers, providing extended daily limits:</p>
                        <ul className="list-disc ml-6 space-y-2">
                            <li><strong className="text-white">Subscribed tier limits:</strong> Up to 40 LLM-based AI searches per day; up to 100 standard (non-LLM) searches per day; unlimited Roulette matches.</li>
                            <li>Subscriptions are available on a Weekly, Monthly, 3-Month, 6-Month, or Yearly basis. Yearly pricing provides the greatest cost benefit.</li>
                            <li>Subscriptions are activated immediately upon successful payment and extend your existing subscription if one is already active.</li>
                            <li>All payments are processed securely via Razorpay. Glysmork does not store your payment card details.</li>
                            <li><strong className="text-white">Refund Policy:</strong> Subscriptions are non-refundable once activated. If you experience a billing issue, contact <span className="text-purple-400">billing@glysmork.com</span> within 7 days of purchase.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">6. AI Data Processing & Profile Analysis</h2>
                        <p className="mb-3">By using Glysmork, you acknowledge and consent to the following AI-related data practices:</p>
                        <ul className="list-disc ml-6 space-y-2">
                            <li>Your onboarding responses are summarized and embedded into a vector representation using third-party LLM APIs (e.g., Google Gemini). This data is stored on our servers to enable matchmaking.</li>
                            <li>Your intent queries during searching may be sent to LLM APIs to compute semantic matches. We minimize such calls to control costs — this is also why daily AI search limits exist.</li>
                            <li>Conversations may be analyzed by AI to improve your profile and connection accuracy. This also includes automated fraud and misconduct detection.</li>
                            <li>Our system is designed to detect dishonest or surface-level answers (&quot;the Cap Test&quot;). If flagged, you will be asked to provide more thoughtful answers. Repeated dishonest behavior may restrict your access to matching features.</li>
                            <li>The onboarding quiz can only be re-taken once per week to ensure genuine responses.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">7. Conversation Monitoring</h2>
                        <p>By using Glysmork, you consent to the following:</p>
                        <ul className="list-disc ml-6 mt-3 space-y-2">
                            <li>You may download a transcript of any conversation you are part of.</li>
                            <li>Messages deleted &quot;for everyone&quot; are hidden from view but may be retained for moderation if the conversation is reported.</li>
                            <li>Reported conversations are stored and accessible to our moderation team.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">8. Prohibited Conduct</h2>
                        <ul className="list-disc ml-6 space-y-2">
                            <li>Harassment, hate speech, threats, or abusive behavior towards other users.</li>
                            <li>Impersonation or creating misleading profiles.</li>
                            <li>Spamming, solicitation, or commercial use without authorization.</li>
                            <li>Exploiting the matching system by manipulating your profile data.</li>
                            <li>Attempting to circumvent daily usage limits through technical means (e.g., using multiple accounts).</li>
                            <li>Any illegal activity conducted through the platform.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">9. Reporting & Moderation</h2>
                        <ul className="list-disc ml-6 space-y-2">
                            <li>Users can report other users for violations. All reports are reviewed by our moderation team.</li>
                            <li>Reported accounts are flagged and stored for review, including their message history.</li>
                            <li>Glysmork reserves the right to ban accounts or restrict features at our discretion.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">10. Limitation of Liability</h2>
                        <p>Glysmork provides connections based on AI analysis. We do not guarantee the suitability, safety, or behavior of any matched user. Interactions with other users are entirely at your own risk. Glysmork is not responsible for any consequences arising from connections made through the platform.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">11. Changes to Terms</h2>
                        <p>We may update these Terms of Service at any time. Continued use of Glysmork after changes are posted constitutes acceptance of the updated terms.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">12. Contact</h2>
                        <p>For questions about these terms, contact us at <span className="text-purple-400">legal@glysmork.com</span>. For billing issues, contact <span className="text-purple-400">billing@glysmork.com</span>.</p>
                    </section>
                </div>

                <div className="mt-16 pt-8 border-t border-slate-200/60 shadow-sm text-center">
                    <Link href="/privacy" className="text-purple-400 hover:text-purple-300 text-sm">Privacy Policy</Link>
                    <span className="text-gray-600 mx-3">•</span>
                    <Link href="/wallet" className="text-purple-400 hover:text-purple-300 text-sm">Subscription Plans</Link>
                    <span className="text-gray-600 mx-3">•</span>
                    <Link href="/" className="text-gray-500 hover:text-gray-400 text-sm">Back to Home</Link>
                </div>
            </div>
        </div>
    );
}
