import React, { createContext, useContext, useState, ReactNode } from 'react';


// Custom type for route data 
export type RouteData = {
    stations: number[];
    lines: number[];
    totalTime: number;
} | null;

type RouteContextType = {
    route: RouteData;
    setRoute: (route: RouteData) => void;
};

// Context allows data to be passed between different tabs
const RouteContext = createContext<RouteContextType | undefined>(undefined);

export function RouteProvider({ children }: { children: ReactNode }) {
    const [route, setRoute] = useState<RouteData>(null);

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
