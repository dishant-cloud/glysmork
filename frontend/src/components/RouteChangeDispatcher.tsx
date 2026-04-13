"use client";

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Dispatches a custom 'next-route-change' event on every soft navigation
 * so that components relying on window.location.pathname via a ref
 * (e.g. NotificationProvider) stay accurate without stale closures.
 */
export default function RouteChangeDispatcher() {
    const pathname = usePathname();

    useEffect(() => {
        window.dispatchEvent(new CustomEvent('next-route-change', { detail: pathname }));
    }, [pathname]);

    return null;
}
