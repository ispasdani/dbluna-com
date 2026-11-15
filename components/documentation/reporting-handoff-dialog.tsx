"use client";

import { useMemo, useState } from "react";
import { ClipboardList, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { emptyReportingBrief, generateReportingHandoff, reportingSources } from "@/lib/generator/reporting-handoff";
import type { ParsedDbmlResult } from "@/lib/parser/dsl-parser";

const inputClass = "w-full rounded-[8px] border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";
const briefFields = [
    ["title", "Report title", "Give this report a short, descriptive name"],
    ["question", "Business question", "Describe the question this report should answer and who will use it"],
    ["rules", "Reporting rules", "Explain how to calculate results, which dates to use, and what to include or exclude"],
    ["reconciliation", "Validation example", "Describe a known result the recipient can check, including filters, dates, and the expected value"],
    ["audience", "Intended audience", "Describe who will use the report and which decisions it supports"],
    ["output", "Expected output", "Describe the metrics, grouping, time period, and format the recipient should produce"],
    ["projectName", "Project / diagram", "Name the project or diagram this snapshot belongs to"],
    ["owner", "Owner", "Name the person or team to contact with questions"],
    ["version", "Version", "Enter a release, revision, or review label"],
] as const;

export function ReportingHandoffDialog({ parsed }: { parsed: ParsedDbmlResult }) {
    const [brief, setBrief] = useState(() => ({ ...emptyReportingBrief, projectName: parsed.project?.name ?? "" }));
    const [selected, setSelected] = useState<Record<string, string>>({});
    const [editingSource, setEditingSource] = useState("");
    const [selectedOnly, setSelectedOnly] = useState(false);
    const [primary, setPrimary] = useState("");
    const [query, setQuery] = useState("");
    const [includeNotes, setIncludeNotes] = useState(false);
    const [includeSql, setIncludeSql] = useState(false);
    const [preview, setPreview] = useState<string | null>(null);
    const sources = useMemo(() => reportingSources(parsed), [parsed]);
    const included = sources.filter(source => Object.hasOwn(selected, source.key));
    const visible = sources.filter(source => (!selectedOnly || Object.hasOwn(selected, source.key)) && source.name.toLowerCase().includes(query.trim().toLowerCase()));
    const activeSource = included.find(source => source.key === editingSource) ?? included[0];
    const describedCount = included.filter(source => selected[source.key]?.trim()).length;
    const missing = [!brief.title.trim() && "a report title", !brief.question.trim() && "a business question", !included.length && "at least one source"].filter(Boolean);
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
            <DialogContent className="flex h-[min(820px,90dvh)] max-h-[90dvh] flex-col gap-0 overflow-hidden rounded-[14px] p-0 sm:max-w-4xl">
                <DialogHeader className="shrink-0 border-b border-border px-6 py-5 pr-12">
                    <DialogTitle className="text-lg">Reporting Handoff</DialogTitle>
                    <DialogDescription>Share the purpose, sources, and rules behind a report in a standalone HTML guide.</DialogDescription>
                </DialogHeader>
                {preview ? (
                    <>
                        <iframe title="Reporting handoff preview" sandbox="allow-scripts allow-modals" srcDoc={preview} className="min-h-0 w-full flex-1 border-0 bg-background" />
                        <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-border bg-background px-6 py-4 [&_button]:rounded-[8px]">
                            <Button variant="outline" onClick={() => setPreview(null)}>Edit handoff</Button>
                            <Button onClick={download}><Download className="size-4" /> Download HTML</Button>
                        </div>
                    </>
                ) : (
                    <form className="flex min-h-0 flex-1 flex-col" onSubmit={event => {
                        event.preventDefault();
                        if (canPreview) setPreview(generateReportingHandoff(parsed, brief, selected, primary, { includeNotes, includeSql }));
                    }}>
                        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto bg-muted/20 px-6 py-5">
                        <section className="space-y-3 rounded-[10px] border border-border bg-background p-4">
                        <h3 className="text-sm font-semibold">Report brief</h3>
                        <p className="text-xs text-muted-foreground">Start with a title and a question. Rules and validation examples are optional.</p>
                        <div className="grid gap-4 sm:grid-cols-2">
                            {briefFields.slice(0, 2).map(([field, label, placeholder]) => (
                                <label key={field} className="space-y-1 text-sm">
                                    <span className="font-medium">{label} <span className="text-xs font-normal text-muted-foreground">{field === "title" || field === "question" ? "(required)" : "(optional)"}</span></span>
                                    {["title", "projectName", "owner", "version"].includes(field) ? (
                                        <input required={field === "title"} className={inputClass} value={brief[field] ?? ""} placeholder={placeholder} onChange={event => setBrief({ ...brief, [field]: event.target.value })} />
                                    ) : (
                                        <textarea required={field === "question"} rows={2} className={inputClass} value={brief[field] ?? ""} placeholder={placeholder} onChange={event => setBrief({ ...brief, [field]: event.target.value })} />
                                    )}
                                </label>
                            ))}
                        </div>
                        <details className="rounded-[8px] border border-border p-3">
                            <summary className="cursor-pointer text-sm font-medium">Reporting guidance and export details <span className="font-normal text-muted-foreground">(optional)</span></summary>
                            <div className="mt-4 grid gap-4 sm:grid-cols-2">
                            {briefFields.slice(2).map(([field, label, placeholder]) => (
                                <label key={field} className="space-y-1 text-sm">
                                    <span className="font-medium">{label} <span className="text-xs font-normal text-muted-foreground">{field === "title" || field === "question" ? "(required)" : "(optional)"}</span></span>
                                    {["title", "projectName", "owner", "version"].includes(field) ? (
                                        <input required={field === "title"} className={inputClass} value={brief[field] ?? ""} placeholder={placeholder} onChange={event => setBrief({ ...brief, [field]: event.target.value })} />
                                    ) : (
                                        <textarea required={field === "question"} rows={2} className={inputClass} value={brief[field] ?? ""} placeholder={placeholder} onChange={event => setBrief({ ...brief, [field]: event.target.value })} />
                                    )}
                                </label>
                            ))}
                            </div>
                        </details>
                        </section>
                        <fieldset className="space-y-3 rounded-[10px] border border-border bg-background p-4">
                            <legend className="px-1 text-sm font-semibold">Sources · {included.length} selected</legend>
                            <p className="text-xs text-muted-foreground">Choose the tables and views the recipient needs. Search to narrow the list.</p>
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
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                                <label className="flex items-center gap-2"><input type="checkbox" checked={selectedOnly} onChange={event => setSelectedOnly(event.target.checked)} /> Show selected only</label>
                                <Button type="button" variant="ghost" size="sm" disabled={!included.length} onClick={() => { setSelected({}); setPrimary(""); }}>Clear selection</Button>
                            </div>
                            <div className="max-h-48 space-y-1 overflow-auto rounded-[8px] border border-border p-2">
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
                                    <span>Recommended starting source <span className="text-xs text-muted-foreground">(optional)</span></span>
                                    <select className={inputClass} value={included.some(source => source.key === primary) ? primary : ""} onChange={event => setPrimary(event.target.value)}>
                                        <option value="">No recommendation</option>
                                        {included.map(source => <option key={source.key} value={source.key}>{source.name}</option>)}
                                    </select>
                                </label>
                                <details className="rounded-[8px] border border-border bg-background p-3">
                                    <summary className="cursor-pointer text-sm font-medium">Describe source rows <span className="text-xs font-normal text-muted-foreground">(optional · {describedCount} of {included.length} described)</span></summary>
                                    <p id="row-description-help" className="my-3 text-xs text-muted-foreground">Explain what a single record represents, such as an entity, an event, or a relationship between records. Include what makes each row distinct. Edit one source at a time; your descriptions are kept when you switch.</p>
                                    <label className="block space-y-1 text-sm">
                                        <span>Source to describe</span>
                                        <select className={inputClass} value={activeSource?.key ?? ""} onChange={event => setEditingSource(event.target.value)}>
                                            {included.map(source => <option key={source.key} value={source.key}>{source.name}{selected[source.key]?.trim() ? " · Described" : ""}</option>)}
                                        </select>
                                    </label>
                                    {activeSource && <label className="mt-3 block space-y-1 text-sm">
                                        <span>Row meaning</span>
                                        <textarea rows={3} className={inputClass} aria-describedby="row-description-help" value={selected[activeSource.key]} placeholder="Describe what one record represents and which entity, event, or relationship it captures." onChange={event => setSelected({ ...selected, [activeSource.key]: event.target.value })} />
                                    </label>}
                                </details>
                            </div>
                        )}
                        <fieldset className="space-y-3 rounded-[10px] border border-border bg-background p-4 text-sm">
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
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-background px-6 py-4">
                            <p id="handoff-readiness" role="status" className="max-w-lg text-xs text-muted-foreground">{canPreview ? `${included.length} sources included. Optional details can be added later.` : `To preview, add ${missing.join(", ")}.`}</p>
                            <Button type="submit" className="shrink-0 rounded-[8px]" aria-describedby="handoff-readiness" disabled={!canPreview}>Preview handoff</Button>
                        </div>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
