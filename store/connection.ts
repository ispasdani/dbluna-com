import { create } from 'zustand';

export interface ConnectionConfig {
    server: string;
    port?: number;
    user?: string;
    password?: string;
    options?: {
        encrypt?: boolean;
        trustServerCertificate?: boolean;
        [key: string]: any;
    };
    authenticationMode?: 'sql' | 'windows';
}

interface ConnectionState {
    connectionConfig: ConnectionConfig | null;
    setConnectionConfig: (config: ConnectionConfig | null) => void;
    clearConnection: () => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
    connectionConfig: null,
    setConnectionConfig: (config) => set({ connectionConfig: config }),
    clearConnection: () => set({ connectionConfig: null }),
}));
