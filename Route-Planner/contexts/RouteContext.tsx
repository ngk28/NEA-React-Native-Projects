import { optimalRouteOutcome, segmentKey } from '@/components/types';
import React, { createContext, ReactNode, useContext, useState } from 'react';




type RouteContextType = {
    route: optimalRouteOutcome | null;
    setRoute: (route: optimalRouteOutcome | null) => void;
    path: segmentKey | null;
    setPath: (path: segmentKey | null) => void;
};

// Context allows data to be passed between different tabs
const RouteContext = createContext<RouteContextType | undefined>(undefined);

export function RouteProvider({ children }: { children: ReactNode }) {
    const [route, setRoute] = useState<optimalRouteOutcome | null>(null);
    const [path, setPath] = useState<segmentKey | null>(null);
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
