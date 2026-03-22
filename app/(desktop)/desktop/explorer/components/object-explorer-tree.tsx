"use client";

import { useState, useEffect } from "react";
import { 
    ChevronRight, 
    ChevronDown, 
    Database, 
    Folder, 
    FolderOpen, 
    Table as TableIcon, 
    LayoutGrid, 
    FileCode, 
    Server
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";

export type DbObjectNode = {
    id: string; // e.g. "db:Master:tables:dbo.Users"
    name: string;
    type: 'server' | 'database' | 'folder' | 'table' | 'view' | 'procedure';
    dbName?: string;
    schemaName?: string;
    childrenLoaded: boolean;
    children?: DbObjectNode[];
};

interface ObjectExplorerTreeProps {
    onNodeDoubleClick: (node: DbObjectNode) => void;
    onNodeAction?: (action: 'select' | 'design' | 'script-create', node: DbObjectNode) => void;
}

export function ObjectExplorerTree({ onNodeDoubleClick, onNodeAction }: ObjectExplorerTreeProps) {
    const [databases, setDatabases] = useState<DbObjectNode[]>([]);
    const [isLoadingInit, setIsLoadingInit] = useState(true);
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['server:localhost']));

    useEffect(() => {
        const fetchDatabases = async () => {
            if (typeof window !== "undefined" && (window as any).electron) {
                try {
                    const result = await (window as any).electron.getDatabases();
                    if (result && result.success) {
                        const dbNodes = result.data.map((db: any) => ({
                            id: `db:${db.name}`,
                            name: db.name,
                            type: 'database',
                            dbName: db.name,
                            childrenLoaded: false,
                        }));
                        setDatabases(dbNodes);
                    }
                } catch (error) {
                    console.error("Failed to fetch databases", error);
                } finally {
                    setIsLoadingInit(false);
                }
            }
        };

        // We assume connection is already established by the parent
        // or we just try fetching databases. If parent handles connection, we wait for it.
        // For simplicity, we just fetch here. If no connection, it might fail.
        fetchDatabases();
    }, []);

    const toggleNode = async (node: DbObjectNode, updateNodeState: (newNode: DbObjectNode) => void) => {
        const isExpanded = expandedNodes.has(node.id);
        const newExpandedNodes = new Set(expandedNodes);
        
        if (isExpanded) {
            newExpandedNodes.delete(node.id);
            setExpandedNodes(newExpandedNodes);
            return;
        }

        newExpandedNodes.add(node.id);
        setExpandedNodes(newExpandedNodes);

        if (!node.childrenLoaded && (node.type === 'database' || node.type === 'folder')) {
            await loadChildren(node, updateNodeState);
        }
    };

    const loadChildren = async (node: DbObjectNode, updateNodeState: (newNode: DbObjectNode) => void) => {
        if (!node.dbName) return;

        let newChildren: DbObjectNode[] = [];
        try {
            if (node.type === 'database') {
                newChildren = [
                    { id: `folder:${node.dbName}:Tables`, name: 'Tables', type: 'folder', dbName: node.dbName, childrenLoaded: false },
                    { id: `folder:${node.dbName}:Views`, name: 'Views', type: 'folder', dbName: node.dbName, childrenLoaded: false },
                    { id: `folder:${node.dbName}:Programmability`, name: 'Programmability', type: 'folder', dbName: node.dbName, childrenLoaded: false },
                ];
            } else if (node.type === 'folder') {
                if (node.name === 'Tables') {
                    const res = await (window as any).electron.getTables(node.dbName);
                    if (res && res.success && res.data) {
                        newChildren = res.data.map((t: any) => ({
                            id: `table:${node.dbName}:${t.TABLE_SCHEMA}.${t.TABLE_NAME}`,
                            name: `${t.TABLE_SCHEMA}.${t.TABLE_NAME}`,
                            type: 'table',
                            dbName: node.dbName,
                            schemaName: t.TABLE_SCHEMA,
                            childrenLoaded: true,
                        }));
                    }
                } else if (node.name === 'Views') {
                    const res = await (window as any).electron.getViews(node.dbName);
                    if (res && res.success && res.data) {
                        newChildren = res.data.map((v: any) => ({
                            id: `view:${node.dbName}:${v.TABLE_SCHEMA}.${v.TABLE_NAME}`,
                            name: `${v.TABLE_SCHEMA}.${v.TABLE_NAME}`,
                            type: 'view',
                            dbName: node.dbName,
                            schemaName: v.TABLE_SCHEMA,
                            childrenLoaded: true,
                        }));
                    }
                } else if (node.name === 'Programmability') {
                    newChildren = [
                        { id: `folder:${node.dbName}:StoredProcedures`, name: 'Stored Procedures', type: 'folder', dbName: node.dbName, childrenLoaded: false }
                    ];
                } else if (node.name === 'Stored Procedures') {
                    const res = await (window as any).electron.getStoredProcedures(node.dbName);
                    if (res && res.success && res.data) {
                        newChildren = res.data.map((p: any) => ({
                            id: `proc:${node.dbName}:${p.schema_name}.${p.procedure_name}`,
                            name: `${p.schema_name}.${p.procedure_name}`,
                            type: 'procedure',
                            dbName: node.dbName,
                            schemaName: p.schema_name,
                            childrenLoaded: true,
                        }));
                    }
                }
            }

            const updatedNode = { ...node, childrenLoaded: true, children: newChildren };
            updateNodeState(updatedNode);
            
        } catch (error) {
            console.error(`Failed to load children for ${node.id}`, error);
        }
    };

    const renderIcon = (type: string, isExpanded: boolean) => {
        switch (type) {
            case 'server': return <Server className="h-4 w-4 text-emerald-500 shrink-0" />;
            case 'database': return <Database className="h-4 w-4 text-yellow-500 shrink-0" />;
            case 'folder': return isExpanded ? <FolderOpen className="h-4 w-4 text-blue-400 shrink-0" /> : <Folder className="h-4 w-4 text-blue-400 shrink-0" />;
            case 'table': return <TableIcon className="h-4 w-4 text-slate-400 shrink-0" />;
            case 'view': return <LayoutGrid className="h-4 w-4 text-slate-400 shrink-0" />;
            case 'procedure': return <FileCode className="h-4 w-4 text-slate-400 shrink-0" />;
            default: return <Database className="h-4 w-4 text-slate-400 shrink-0" />;
        }
    };

    const TreeNode = ({ node, level, updateNodeState }: { node: DbObjectNode, level: number, updateNodeState: (updatedNode: DbObjectNode) => void }) => {
        const isExpanded = expandedNodes.has(node.id);
        const isLeaf = ['table', 'view', 'procedure'].includes(node.type);

        const handleUpdateChild = (childId: string, updatedChild: DbObjectNode) => {
            if (!node.children) return;
            const newChildren = node.children.map(c => c.id === childId ? updatedChild : c);
            updateNodeState({ ...node, children: newChildren });
        };

        const handleDoubleClick = () => {
            if (node.type === 'table' || node.type === 'view') {
                onNodeDoubleClick(node);
            }
        };

        const triggerContent = (
            <div 
                className={cn(
                    "flex items-center w-full py-1 px-2 text-sm text-slate-300 hover:bg-slate-800/50 hover:text-white rounded-md transition-colors",
                )}
                style={{ paddingLeft: `${level * 12 + 8}px` }}
                onDoubleClick={handleDoubleClick}
                onClick={() => !isLeaf && toggleNode(node, updateNodeState)}
            >
                <div className="w-4 h-4 mr-1 flex items-center justify-center shrink-0">
                    {!isLeaf && (
                        isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-slate-500" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                    )}
                </div>
                {renderIcon(node.type, isExpanded)}
                <span className="ml-2 truncate select-none text-left">{node.name}</span>
            </div>
        );

        let content = (
            <Collapsible open={isExpanded} onOpenChange={() => {}}>
                {isLeaf && node.type === 'table' ? (
                    <ContextMenu>
                        <ContextMenuTrigger asChild>
                            {triggerContent}
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-64 bg-slate-900 border-slate-800 text-slate-300">
                            <ContextMenuItem 
                                className="cursor-pointer hover:bg-slate-800 focus:bg-slate-800"
                                onClick={() => onNodeAction?.('select', node)}
                            >
                                Select Top 1000 Rows
                            </ContextMenuItem>
                            <ContextMenuItem 
                                className="cursor-pointer hover:bg-slate-800 focus:bg-slate-800"
                                onClick={() => onNodeAction?.('design', node)}
                            >
                                Design
                            </ContextMenuItem>
                            <ContextMenuItem 
                                className="cursor-pointer hover:bg-slate-800 focus:bg-slate-800"
                                onClick={() => onNodeAction?.('script-create', node)}
                            >
                                Script Table as <ChevronRight className="ml-1 h-3 w-3 inline" /> CREATE To <ChevronRight className="ml-1 h-3 w-3 inline" /> New Query Editor Window
                            </ContextMenuItem>
                        </ContextMenuContent>
                    </ContextMenu>
                ) : (
                    triggerContent
                )}
                {!isLeaf && node.childrenLoaded && node.children && (
                    <CollapsibleContent>
                        {node.children.map(child => (
                            <TreeNode 
                                key={child.id} 
                                node={child} 
                                level={level + 1} 
                                updateNodeState={(newChild) => handleUpdateChild(child.id, newChild)} 
                            />
                        ))}
                    </CollapsibleContent>
                )}
            </Collapsible>
        );

        return content;
    };

    if (isLoadingInit) {
        return <div className="p-4 text-sm text-slate-500 animate-pulse">Loading Object Explorer...</div>;
    }

    const serverNode: DbObjectNode = {
        id: 'server:localhost',
        name: 'localhost (SQL Server)',
        type: 'server',
        childrenLoaded: true,
        children: databases
    };

    return (
        <div className="w-full h-full flex flex-col py-2">
            <TreeNode 
                node={serverNode} 
                level={0} 
                updateNodeState={(updatedNode) => setDatabases(updatedNode.children || [])} 
            />
        </div>
    );
}
