import { OptimalRouteResult, RouteQuery } from '@/components/types';
import React, { createContext, ReactNode, useContext, useState } from 'react';

// Context allows data to be passed between different tabs
type RouteContextType = {
    routeResult: OptimalRouteResult | null;
    setRouteResult: (route: OptimalRouteResult | null) => void;
    selectedPath: RouteQuery | null;
    setSelectedPath: (path: RouteQuery | null) => void;
};
const RouteContext = createContext<RouteContextType | undefined>(undefined);

// Makes route data available to all child components (wrapped in _layout)
// Allows pages to share selected path and route details without needing through components
export function RouteProvider({ children }: { children: ReactNode }) {
    const [routeResult, setRouteResult] = useState<OptimalRouteResult | null>(null);
    const [selectedPath, setSelectedPath] = useState<RouteQuery | null>(null);
    return (
        <RouteContext.Provider value={{ routeResult, setRouteResult, selectedPath, setSelectedPath }}>
            {children}
        </RouteContext.Provider>
    );
}

export function useRoute() {
    const context = useContext(RouteContext);
    if (context === undefined) {
        throw new Error('RouteProvider error');
    }
    return context;
}