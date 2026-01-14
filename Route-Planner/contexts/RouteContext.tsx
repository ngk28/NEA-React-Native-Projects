import React, { createContext, useContext, useState, ReactNode } from 'react';
import { pathFinderResult, pathKey } from '@/components/types';




type RouteContextType = {
    route: pathFinderResult | null;
    setRoute: (route: pathFinderResult | null) => void;
    path: pathKey | null;
    setPath: (path: pathKey | null) => void;
};

// Context allows data to be passed between different tabs
const RouteContext = createContext<RouteContextType | undefined>(undefined);

export function RouteProvider({ children }: { children: ReactNode }) {
    const [route, setRoute] = useState<pathFinderResult | null>(null);
    const [path, setPath] = useState<pathKey | null>(null);
    return (
        <RouteContext.Provider value={{ route, setRoute, path, setPath }}>
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
