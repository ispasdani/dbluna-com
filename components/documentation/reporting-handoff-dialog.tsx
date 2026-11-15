"use client";

import { useMemo, useState } from "react";
import { ClipboardList, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { emptyReportingBrief, generateReportingHandoff, reportingSources } from "@/lib/generator/reporting-handoff";
import type { ParsedDbmlResult } from "@/lib/parser/dsl-parser";

const inputClass = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm";
const briefFields = [
    ["title", "Report title", "Monthly sales by customer and product"],
    ["question", "Business question", "What should the finished report answer?"],
    ["rules", "Reporting rules", "Authoritative dates, metric definitions, exclusions, and join caveats"],
    ["reconciliation", "Validation example", "A period, filter, and expected total to reconcile against"],
] as const;

export function ReportingHandoffDialog({ parsed }: { parsed: ParsedDbmlResult }) {
    const [brief, setBrief] = useState(emptyReportingBrief);
    const [selected, setSelected] = useState<Record<string, string>>({});
    const [primary, setPrimary] = useState("");
    const [query, setQuery] = useState("");
    const [includeNotes, setIncludeNotes] = useState(false);
    const [includeSql, setIncludeSql] = useState(false);
    const [preview, setPreview] = useState<string | null>(null);
    const sources = useMemo(() => reportingSources(parsed), [parsed]);
    const included = sources.filter(source => Object.hasOwn(selected, source.key));
    const visible = sources.filter(source => source.name.toLowerCase().includes(query.trim().toLowerCase()));
    const canPreview = Boolean(brief.title.trim() && brief.question.trim() && included.length);

    const download = () => {
        if (!preview) return;
        const url = URL.createObjectURL(new Blob([preview], { type: "text/html;charset=utf-8" }));
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = (brief.title.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "reporting-handoff") + ".html";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    return (
        <Dialog onOpenChange={open => { if (!open) setPreview(null); }}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 shrink-0 text-xs" disabled={!sources.length}>
                    <ClipboardList className="size-4" />
                    Reporting Handoff
                </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-lg p-6 sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle className="text-lg">Reporting Handoff</DialogTitle>
                    <DialogDescription>Build a searchable HTML guide from the tables and views you choose.</DialogDescription>
                </DialogHeader>
                {preview ? (
                    <>
                        <iframe title="Reporting handoff preview" sandbox="allow-scripts" srcDoc={preview} className="h-[52dvh] w-full rounded-md border bg-white" />
                        <div className="flex flex-wrap justify-end gap-2">
                            <Button variant="outline" onClick={() => setPreview(null)}>Edit handoff</Button>
                            <Button onClick={download}><Download className="size-4" /> Download HTML</Button>
                        </div>
                    </>
                ) : (
                    <form className="space-y-5" onSubmit={event => {
                        event.preventDefault();
                        if (canPreview) setPreview(generateReportingHandoff(parsed, brief, selected, primary, { includeNotes, includeSql }));
                    }}>
                        <div className="grid gap-3 sm:grid-cols-2">
                            {briefFields.map(([field, label, placeholder]) => (
                                <label key={field} className="space-y-1 text-sm">
                                    <span>{label}</span>
                                    {field === "title" ? (
                                        <input required className={inputClass} value={brief[field]} placeholder={placeholder} onChange={event => setBrief({ ...brief, [field]: event.target.value })} />
                                    ) : (
                                        <textarea required={field === "question"} rows={2} className={inputClass} value={brief[field]} placeholder={placeholder} onChange={event => setBrief({ ...brief, [field]: event.target.value })} />
                                    )}
                                </label>
                            ))}
                        </div>
                        <fieldset className="space-y-2">
                            <legend className="text-sm font-semibold">Sources ({included.length} selected)</legend>
                            <div className="flex flex-wrap items-center gap-2">
                                <input type="search" aria-label="Find tables and views" placeholder="Find tables and views" className={inputClass + " min-w-40 flex-1"} value={query} onChange={event => setQuery(event.target.value)} />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={included.length === sources.length}
                                    onClick={() => setSelected(current => Object.fromEntries(
                                        sources.map(source => [source.key, current[source.key] ?? ""]),
                                    ))}
                                >
                                    Select all sources
                                </Button>
                            </div>
                            <div className="max-h-36 space-y-1 overflow-auto rounded-md border p-2">
                                {visible.map(source => (
                                    <label key={source.key} className="flex items-start gap-2 rounded p-1 text-sm hover:bg-accent">
                                        <input type="checkbox" className="mt-1" checked={Object.hasOwn(selected, source.key)} onChange={event => {
                                            const next = { ...selected };
                                            if (event.target.checked) next[source.key] = "";
                                            else delete next[source.key];
                                            setSelected(next);
                                        }} />
                                        <span className="min-w-0 break-all">{source.name} <small className="text-muted-foreground">{source.kind}</small></span>
                                    </label>
                                ))}
                                {!visible.length && <p className="text-muted-foreground">No matching sources.</p>}
                            </div>
                        </fieldset>
                        {included.length > 0 && (
                            <div className="space-y-3">
                                <label className="block space-y-1 text-sm">
                                    <span>Recommended starting source</span>
                                    <select className={inputClass} value={included.some(source => source.key === primary) ? primary : ""} onChange={event => setPrimary(event.target.value)}>
                                        <option value="">Choose a source</option>
                                        {included.map(source => <option key={source.key} value={source.key}>{source.name}</option>)}
                                    </select>
                                </label>
                                {included.map(source => (
                                    <label key={source.key} className="block space-y-1 text-sm">
                                        <span>What one row in <strong>{source.name}</strong> represents</span>
                                        <input className={inputClass} value={selected[source.key]} placeholder="Example: one line on an order" onChange={event => setSelected({ ...selected, [source.key]: event.target.value })} />
                                    </label>
                                ))}
                            </div>
                        )}
                        <fieldset className="space-y-2 text-sm">
                            <legend className="mb-1 font-semibold">Include in the download</legend>
                            <label className="flex items-center gap-2">
                                <input type="checkbox" checked={includeNotes} onChange={event => setIncludeNotes(event.target.checked)} />
                                Imported descriptions and authored notes
                            </label>
                            <label className="flex items-center gap-2">
                                <input type="checkbox" checked={includeSql} onChange={event => setIncludeSql(event.target.checked)} />
                                SQL definitions for selected views
                            </label>
                        </fieldset>
                        <div className="flex justify-end">
                            <Button type="submit" disabled={!canPreview}>Preview handoff</Button>
                        </div>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
