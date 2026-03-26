"use client";

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

interface LogoProps {
    size?: 'sm' | 'md' | 'lg';
    showText?: boolean;
    className?: string;
}

const sizes = {
    sm: { icon: 24, text: 'text-lg' },
    md: { icon: 32, text: 'text-xl' },
    lg: { icon: 40, text: 'text-2xl' },
};

export default function Logo({ size = 'md', showText = true, className = '' }: LogoProps) {
    const s = sizes[size];
    const [href, setHref] = useState('/');

    useEffect(() => {
        if (typeof window !== 'undefined' && localStorage.getItem('user')) {
            setHref('/dashboard');
        }
    }, []);

    return (
        <Link href={href} className={`flex items-center gap-2.5 ${className}`}>
            <Image
                src="/logo.png"
                alt="Glysmork"
                width={s.icon}
                height={s.icon}
                className="rounded-lg"
            />
            {showText && (
                <span className={`font-bold ${s.text} bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-cyan-400 tracking-tight`}>
                    Glysmork
                </span>
            )}
        </Link>
    );
}
