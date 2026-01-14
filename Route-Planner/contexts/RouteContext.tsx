import React, { createContext, useContext, useState, ReactNode } from 'react';
import { pathFinderResult } from '@/components/pathFinder';

type RouteContextType = {
    route: pathFinderResult | null;
    setRoute: (route: pathFinderResult | null) => void;
};

// Context allows data to be passed between different tabs
const RouteContext = createContext<RouteContextType | undefined>(undefined);

export function RouteProvider({ children }: { children: ReactNode }) {
    const [route, setRoute] = useState<pathFinderResult | null>(null);

    return (
        <RouteContext.Provider value={{ route, setRoute }}>
            {children}
        </RouteContext.Provider>
    );
}

export function useRoute() {
    const context = useContext(RouteContext);
    if (context === undefined) {
        throw new Error('useRoute must be used within a RouteProvider');
    }
    return context;
}
