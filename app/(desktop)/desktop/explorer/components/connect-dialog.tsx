"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConnectionStore } from "../../store/connection";
import { Database, Server, Key, Shield, ShieldAlert, Loader2 } from "lucide-react";

interface ConnectionProfile {
    server: string;
    authenticationMode: "sql" | "windows";
    username?: string;
}

interface ConnectDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConnected: () => void;
}

export function ConnectToServerDialog({ open, onOpenChange, onConnected }: ConnectDialogProps) {
    const setConnectionConfig = useConnectionStore((state) => state.setConnectionConfig);

    const [serverType, setServerType] = useState("Database Engine");
    const [serverName, setServerName] = useState("localhost");
    const [authenticationMode, setAuthenticationMode] = useState<"sql" | "windows">("sql");
    const [username, setUsername] = useState("sa");
    const [password, setPassword] = useState("Armagedon-14");
    const [recentConnections, setRecentConnections] = useState<ConnectionProfile[]>([]);

    useEffect(() => {
        try {
            const saved = localStorage.getItem("dbviewer_recent_connections");
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    setRecentConnections(parsed);
                }
            }
        } catch (e) {
            console.error("Failed to load recent connections:", e);
        }
    }, []);

    const handleServerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setServerName(val);
        
        // Auto-fill if profile exists
        const existing = recentConnections.find(c => c.server === val);
        if (existing) {
            setAuthenticationMode(existing.authenticationMode);
            if (existing.username) setUsername(existing.username);
        }
    };
    const [encrypt, setEncrypt] = useState(false);
    const [trustServerCertificate, setTrustServerCertificate] = useState(true);

    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleConnect = async () => {
        setIsConnecting(true);
        setError(null);

        const config = {
            server: serverName,
            port: 1433,
            user: authenticationMode === "sql" ? username : undefined,
            password: authenticationMode === "sql" ? password : undefined,
            options: {
                encrypt,
                trustServerCertificate
            }
        };

        try {
            if (typeof window !== "undefined" && (window as any).electron) {
                const connResult = await (window as any).electron.connectDb(config);
                if (connResult && connResult.success) {
                    setConnectionConfig({ ...config, authenticationMode });
                    
                    try {
                        const newProfile: ConnectionProfile = {
                            server: serverName,
                            authenticationMode,
                            username: authenticationMode === "sql" ? username : undefined
                        };
                        const existing = recentConnections.filter(c => c.server !== serverName);
                        const updated = [newProfile, ...existing].slice(0, 10);
                        setRecentConnections(updated);
                        localStorage.setItem("dbviewer_recent_connections", JSON.stringify(updated));
                    } catch (e) {
                        console.error("Failed to save connection profile:", e);
                    }

                    onConnected();
                    onOpenChange(false);
                } else {
                    setError(connResult?.error || "Failed to connect to server.");
                }
            } else {
                setError("Electron environment not detected.");
            }
        } catch (err: any) {
            setError(err.message || "An unexpected error occurred.");
        } finally {
            setIsConnecting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[450px] bg-slate-900 border border-slate-800 text-slate-300 shadow-2xl overflow-hidden p-0 gap-0">
                <DialogHeader className="bg-slate-950 px-4 py-3 border-b border-slate-800 m-0 space-y-0">
                    <DialogTitle className="text-slate-100 flex items-center space-x-2 text-md font-semibold font-sans m-0">
                        <Server className="w-5 h-5 text-blue-500" />
                        <span>Connect to Server</span>
                    </DialogTitle>
                </DialogHeader>
                
                <div className="p-6 space-y-5 bg-[#0f111a]">
                    <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-2 items-center">
                            <Label className="text-right text-xs text-slate-400 font-medium whitespace-nowrap">Server type:</Label>
                            <Select value={serverType} onValueChange={setServerType} disabled>
                                <SelectTrigger className="col-span-2 h-8 bg-slate-800 border-slate-700 text-slate-300 px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 rounded-sm">
                                    <SelectValue placeholder="Server type" />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-800 border-slate-700 text-slate-300">
                                    <SelectItem value="Database Engine" className="text-xs">Database Engine</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-2 items-center">
                            <Label className="text-right text-xs text-slate-400 font-medium whitespace-nowrap">Server name:</Label>
                            <Input 
                                value={serverName} 
                                onChange={handleServerChange} 
                                list="recent-servers"
                                className="col-span-2 h-8 bg-slate-800 border-slate-700 text-slate-300 px-2 py-1 text-xs focus-visible:ring-1 focus-visible:ring-blue-500 rounded-sm"
                            />
                            <datalist id="recent-servers">
                                {recentConnections.map(c => (
                                    <option key={c.server} value={c.server} />
                                ))}
                            </datalist>
                        </div>

                        <div className="grid grid-cols-3 gap-2 items-center">
                            <Label className="text-right text-xs text-slate-400 font-medium whitespace-nowrap">Authentication:</Label>
                            <Select value={authenticationMode} onValueChange={(v) => setAuthenticationMode(v as any)}>
                                <SelectTrigger className="col-span-2 h-8 bg-slate-800 border-slate-700 text-slate-300 px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 rounded-sm">
                                    <SelectValue placeholder="Authentication" />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-800 border-slate-700 text-slate-300">
                                    <SelectItem value="sql" className="text-xs">SQL Server Authentication</SelectItem>
                                    <SelectItem value="windows" className="text-xs">Windows Authentication</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {authenticationMode === "sql" && (
                            <>
                                <div className="grid grid-cols-3 gap-2 items-center">
                                    <Label className="text-right text-xs text-slate-400 font-medium whitespace-nowrap">User name:</Label>
                                    <div className="col-span-2 flex items-center bg-slate-800 border border-slate-700 rounded-sm focus-within:ring-1 focus-within:ring-blue-500 overflow-hidden">
                                        <div className="pl-2">
                                            <Database className="w-3.5 h-3.5 text-slate-500" />
                                        </div>
                                        <Input 
                                            value={username} 
                                            onChange={(e) => setUsername(e.target.value)} 
                                            className="h-8 border-none bg-transparent text-slate-300 px-2 py-1 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
                                            placeholder="Login"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-2 items-center">
                                    <Label className="text-right text-xs text-slate-400 font-medium whitespace-nowrap">Password:</Label>
                                    <div className="col-span-2 flex items-center bg-slate-800 border border-slate-700 rounded-sm focus-within:ring-1 focus-within:ring-blue-500 overflow-hidden">
                                        <div className="pl-2">
                                            <Key className="w-3.5 h-3.5 text-slate-500" />
                                        </div>
                                        <Input 
                                            type="password"
                                            value={password} 
                                            onChange={(e) => setPassword(e.target.value)} 
                                            className="h-8 border-none bg-transparent text-slate-300 px-2 py-1 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
                                            placeholder="Password"
                                        />
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="space-y-3 pt-4 border-t border-slate-800/50">
                        <div className="flex items-center space-x-2">
                            <input 
                                type="checkbox" 
                                id="encrypt"
                                checked={encrypt}
                                onChange={(e) => setEncrypt(e.target.checked)}
                                className="w-3 h-3 bg-slate-800 border-slate-700 rounded text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-900"
                            />
                            <Label htmlFor="encrypt" className="text-xs text-slate-400 flex items-center cursor-pointer">
                                <Shield className="w-3.5 h-3.5 mr-1.5" /> Encrypt connection
                            </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <input 
                                type="checkbox" 
                                id="trustCert"
                                checked={trustServerCertificate}
                                onChange={(e) => setTrustServerCertificate(e.target.checked)}
                                className="w-3 h-3 bg-slate-800 border-slate-700 rounded text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-900"
                            />
                            <Label htmlFor="trustCert" className="text-xs text-slate-400 flex items-center cursor-pointer">
                                <ShieldAlert className="w-3.5 h-3.5 mr-1.5" /> Trust server certificate
                            </Label>
                        </div>
                    </div>

                    {error && (
                        <div className="mt-4 p-3 bg-red-950/40 border border-red-900/50 rounded-md text-xs text-red-400">
                            <strong>Connection failed:</strong><br />
                            <span className="break-words mt-1 block opacity-90">{error}</span>
                        </div>
                    )}
                </div>

                <DialogFooter className="bg-slate-950 px-4 py-3 border-t border-slate-800 flex justify-between items-center sm:justify-between m-0">
                    <Button 
                        variant="ghost" 
                        size="sm"
                        className="text-xs text-blue-500 hover:text-blue-400 hover:bg-blue-950/30 px-2"
                    >
                        Options &gt;&gt;
                    </Button>
                    <div className="flex space-x-2">
                        <Button 
                            variant="default" 
                            size="sm" 
                            onClick={handleConnect}
                            disabled={isConnecting}
                            className="bg-blue-600 hover:bg-blue-500 text-white text-xs h-8 px-6 rounded-sm shadow-md"
                        >
                            {isConnecting ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> 
                                    Connecting
                                </>
                            ) : (
                                "Connect"
                            )}
                        </Button>
                        <Button 
                            variant="secondary" 
                            size="sm" 
                            onClick={() => onOpenChange(false)}
                            className="bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs h-8 px-5 border border-slate-700 rounded-sm"
                        >
                            Cancel
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
