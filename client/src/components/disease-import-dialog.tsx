import { useState, useRef, useCallback, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, X, FileText, Download, AlertCircle, CheckCircle2, Loader2, FileSpreadsheet, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { parseFile, generateCSVTemplate, generateXLSXTemplate, type NormalizedRow, type ParseError } from "@/lib/importParser";
import { usePagination } from "@/hooks/use-pagination";
import TablePagination from "@/components/table-pagination";
import { useAuth } from "@/hooks/use-auth";
import { permissions } from "@/hooks/use-auth";

const HISTORY_KEY_PREFIX = "disease_import_history_";
const MAX_HISTORY = 20;

export interface ImportHistoryEntry {
  id: string;
  timestamp: string;
  files: string[];
  totalRows: number;
  validRows: number;
  errorCount: number;
  mode: "append" | "replace";
  imported: number;
}

function getHistoryKey(userId: number | string) {
  return `${HISTORY_KEY_PREFIX}${userId}`;
}

function loadHistory(userId: number | string): ImportHistoryEntry[] {
  try {
    const raw = localStorage.getItem(getHistoryKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(userId: number | string, entries: ImportHistoryEntry[]) {
  try {
    localStorage.setItem(getHistoryKey(userId), JSON.stringify(entries.slice(0, MAX_HISTORY)));
  } catch {
    // ignore
  }
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = "select" | "preview" | "history";

export default function DiseaseImportDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("select");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [validRows, setValidRows] = useState<NormalizedRow[]>([]);
  const [parseErrors, setParseErrors] = useState<ParseError[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [mode, setMode] = useState<"append" | "replace">("append");
  const [replaceConfirmOpen, setReplaceConfirmOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"valid" | "errors">("valid");
  const [history, setHistory] = useState<ImportHistoryEntry[]>(() =>
    user ? loadHistory(user.id) : []
  );

  useEffect(() => {
    if (user?.id) {
      setHistory(loadHistory(user.id));
    }
  }, [user?.id]);

  const validPagination = usePagination(validRows, 10);
  const errorPagination = usePagination(parseErrors, 10);
  const histPagination = usePagination(history, 10);

  const importMutation = useMutation({
    mutationFn: async (payload: { rows: NormalizedRow[]; replace: boolean }) => {
      const res = await apiRequest("POST", "/api/disease-cases/bulk", payload);
      return res.json() as Promise<{ imported: number }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/disease-cases"] });
      const entry: ImportHistoryEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        files: selectedFiles.map(f => f.name),
        totalRows,
        validRows: validRows.length,
        errorCount: parseErrors.length,
        mode,
        imported: data.imported,
      };
      const newHistory = [entry, ...history];
      setHistory(newHistory);
      if (user) saveHistory(user.id, newHistory);

      toast({
        title: "Import successful",
        description: `${data.imported} disease case record(s) added to the registry.`,
      });
      resetDialog();
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Import failed", description: "Could not save disease data.", variant: "destructive" });
    },
  });

  function resetDialog() {
    setStep("select");
    setSelectedFiles([]);
    setValidRows([]);
    setParseErrors([]);
    setTotalRows(0);
    setMode("append");
    setActiveTab("valid");
    setIsParsing(false);
  }

  const addFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    const accepted = Array.from(files).filter(f => /\.(csv|xls|xlsx)$/i.test(f.name));
    setSelectedFiles(prev => {
      const names = new Set(prev.map(f => f.name));
      return [...prev, ...accepted.filter(f => !names.has(f.name))];
    });
  }, []);

  const removeFile = (name: string) => setSelectedFiles(prev => prev.filter(f => f.name !== name));

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  };

  const handleParseFiles = async () => {
    if (selectedFiles.length === 0) return;
    setIsParsing(true);
    const allValid: NormalizedRow[] = [];
    const allErrors: ParseError[] = [];
    let total = 0;
    try {
      for (const file of selectedFiles) {
        const result = await parseFile(file);
        allValid.push(...result.valid);
        allErrors.push(...result.errors);
        total += result.totalRows;
      }
      setValidRows(allValid);
      setParseErrors(allErrors);
      setTotalRows(total);
      setStep("preview");
      setActiveTab(allValid.length > 0 ? "valid" : "errors");
      validPagination.resetPage();
      errorPagination.resetPage();
    } catch (err) {
      toast({ title: "Parse error", description: String(err), variant: "destructive" });
    } finally {
      setIsParsing(false);
    }
  };

  const handleConfirmImport = () => {
    if (mode === "replace") {
      setReplaceConfirmOpen(true);
    } else {
      importMutation.mutate({ rows: validRows, replace: false });
    }
  };

  const downloadCSV = () => {
    const csv = generateCSVTemplate();
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "disease_import_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadXLSX = () => {
    const buf = generateXLSXTemplate();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "disease_import_template.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!permissions.canImportReports(user?.role)) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) resetDialog(); onOpenChange(v); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Import Disease Surveillance Data
            </DialogTitle>
            <DialogDescription>
              Upload CSV or Excel files to bulk-import disease case data into the registry.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-2 border-b pb-2 mb-4">
            <Button size="sm" variant={step === "select" ? "default" : "ghost"} onClick={() => setStep("select")} data-testid="tab-import-select">
              <Upload className="h-3.5 w-3.5 mr-1" /> Upload Files
            </Button>
            <Button size="sm" variant={step === "preview" ? "default" : "ghost"} onClick={() => validRows.length > 0 && setStep("preview")} disabled={validRows.length === 0 && parseErrors.length === 0} data-testid="tab-import-preview">
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Preview & Validate
            </Button>
            <Button size="sm" variant={step === "history" ? "default" : "ghost"} onClick={() => setStep("history")} data-testid="tab-import-history">
              <History className="h-3.5 w-3.5 mr-1" /> Import History
            </Button>
          </div>

          {step === "select" && (
            <div className="space-y-4">
              <div
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/60 transition-colors"
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                data-testid="drop-zone"
              >
                <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="font-medium">Drop files here or click to browse</p>
                <p className="text-sm text-muted-foreground mt-1">Accepts .csv, .xls, .xlsx — multiple files allowed</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xls,.xlsx"
                  multiple
                  className="hidden"
                  onChange={e => addFiles(e.target.files)}
                  data-testid="input-file-picker"
                />
              </div>

              {selectedFiles.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">{selectedFiles.length} file(s) selected</p>
                  {selectedFiles.map(f => (
                    <div key={f.name} className="flex items-center justify-between bg-muted rounded px-3 py-2 text-sm" data-testid={`file-item-${f.name}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                        <span className="truncate">{f.name}</span>
                        <span className="text-xs text-muted-foreground flex-shrink-0">({(f.size / 1024).toFixed(1)} KB)</span>
                      </div>
                      <Button size="icon" variant="ghost" className="h-6 w-6 flex-shrink-0" onClick={(e) => { e.stopPropagation(); removeFile(f.name); }} data-testid={`button-remove-${f.name}`}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <span className="text-sm text-muted-foreground">Download templates:</span>
                <Button size="sm" variant="outline" onClick={downloadCSV} className="gap-1" data-testid="button-download-csv-template">
                  <Download className="h-3.5 w-3.5" /> CSV
                </Button>
                <Button size="sm" variant="outline" onClick={downloadXLSX} className="gap-1" data-testid="button-download-xlsx-template">
                  <Download className="h-3.5 w-3.5" /> XLSX
                </Button>
              </div>
            </div>
          )}

          {step === "preview" && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <Card>
                  <CardContent className="pt-3 pb-3">
                    <p className="text-xs text-muted-foreground">Total Rows</p>
                    <p className="text-2xl font-bold">{totalRows}</p>
                  </CardContent>
                </Card>
                <Card className="border-green-500/30">
                  <CardContent className="pt-3 pb-3">
                    <p className="text-xs text-muted-foreground">Valid Rows</p>
                    <p className="text-2xl font-bold text-green-500">{validRows.length}</p>
                  </CardContent>
                </Card>
                <Card className={parseErrors.length > 0 ? "border-red-500/30" : ""}>
                  <CardContent className="pt-3 pb-3">
                    <p className="text-xs text-muted-foreground">Errors</p>
                    <p className={`text-2xl font-bold ${parseErrors.length > 0 ? "text-red-500" : ""}`}>{parseErrors.length}</p>
                  </CardContent>
                </Card>
              </div>

              <div className="flex gap-2 border-b pb-1">
                <Button size="sm" variant={activeTab === "valid" ? "default" : "ghost"} onClick={() => setActiveTab("valid")} data-testid="subtab-valid">
                  Valid ({validRows.length})
                </Button>
                <Button size="sm" variant={activeTab === "errors" ? "default" : "ghost"} onClick={() => setActiveTab("errors")} disabled={parseErrors.length === 0} data-testid="subtab-errors">
                  Errors ({parseErrors.length})
                </Button>
              </div>

              {activeTab === "valid" && (
                <div>
                  {validRows.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No valid rows found</div>
                  ) : (
                    <>
                      <div className="border rounded-md overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-muted">
                            <tr>
                              <th className="px-3 py-2 text-left">Barangay</th>
                              <th className="px-3 py-2 text-left">Disease</th>
                              <th className="px-3 py-2 text-center">Cases</th>
                              <th className="px-3 py-2 text-left">Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {validPagination.pagedItems.map((row, i) => (
                              <tr key={i} className="border-t">
                                <td className="px-3 py-1.5">{row.barangay}</td>
                                <td className="px-3 py-1.5">{row.disease_name}</td>
                                <td className="px-3 py-1.5 text-center">
                                  <Badge variant="secondary">{row.cases}</Badge>
                                </td>
                                <td className="px-3 py-1.5 text-muted-foreground">{row.reporting_date}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <TablePagination pagination={validPagination} pageSizeOptions={[10, 25, 50]} />
                    </>
                  )}
                </div>
              )}

              {activeTab === "errors" && (
                <div>
                  <div className="border rounded-md overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-3 py-2 text-left">File</th>
                          <th className="px-3 py-2 text-center w-16">Row</th>
                          <th className="px-3 py-2 text-left">Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {errorPagination.pagedItems.map((err, i) => (
                          <tr key={i} className="border-t">
                            <td className="px-3 py-1.5 text-xs text-muted-foreground truncate max-w-[180px]">{err.file}</td>
                            <td className="px-3 py-1.5 text-center">{err.row || "—"}</td>
                            <td className="px-3 py-1.5 text-red-400 text-xs">{err.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <TablePagination pagination={errorPagination} pageSizeOptions={[10, 25]} />
                </div>
              )}

              <div className="border-t pt-3">
                <p className="text-sm font-medium mb-2">Import Mode</p>
                <RadioGroup value={mode} onValueChange={v => setMode(v as "append" | "replace")} className="flex gap-6" data-testid="radio-import-mode">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="append" id="mode-append" data-testid="radio-append" />
                    <Label htmlFor="mode-append">
                      <span className="font-medium">Append</span>
                      <span className="block text-xs text-muted-foreground">Add new records alongside existing ones</span>
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="replace" id="mode-replace" data-testid="radio-replace" />
                    <Label htmlFor="mode-replace">
                      <span className="font-medium">Replace</span>
                      <span className="block text-xs text-muted-foreground">Delete all previously bulk-imported records first</span>
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          )}

          {step === "history" && (
            <div className="space-y-3">
              {history.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p>No import history yet</p>
                </div>
              ) : (
                <>
                  <div className="border rounded-md overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-3 py-2 text-left">Date/Time</th>
                          <th className="px-3 py-2 text-left">Files</th>
                          <th className="px-3 py-2 text-center">Rows</th>
                          <th className="px-3 py-2 text-center">Valid</th>
                          <th className="px-3 py-2 text-center">Errors</th>
                          <th className="px-3 py-2 text-center">Imported</th>
                          <th className="px-3 py-2 text-center">Mode</th>
                        </tr>
                      </thead>
                      <tbody>
                        {histPagination.pagedItems.map(entry => (
                          <tr key={entry.id} className="border-t">
                            <td className="px-3 py-1.5 text-xs text-muted-foreground whitespace-nowrap">
                              {new Date(entry.timestamp).toLocaleString()}
                            </td>
                            <td className="px-3 py-1.5 text-xs max-w-[140px]">
                              <div className="truncate" title={entry.files.join(", ")}>{entry.files.join(", ")}</div>
                            </td>
                            <td className="px-3 py-1.5 text-center">{entry.totalRows}</td>
                            <td className="px-3 py-1.5 text-center text-green-500">{entry.validRows}</td>
                            <td className="px-3 py-1.5 text-center text-red-400">{entry.errorCount}</td>
                            <td className="px-3 py-1.5 text-center font-medium">{entry.imported}</td>
                            <td className="px-3 py-1.5 text-center">
                              <Badge variant={entry.mode === "replace" ? "destructive" : "secondary"} className="text-xs">
                                {entry.mode}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <TablePagination pagination={histPagination} pageSizeOptions={[10]} />
                </>
              )}
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => { resetDialog(); onOpenChange(false); }} data-testid="button-cancel-import">
              Close
            </Button>
            {step === "select" && (
              <Button onClick={handleParseFiles} disabled={selectedFiles.length === 0 || isParsing} data-testid="button-parse-files">
                {isParsing ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Parsing…</> : <><FileText className="h-4 w-4 mr-1" />Parse Files</>}
              </Button>
            )}
            {step === "preview" && (
              <>
                <Button variant="outline" onClick={() => setStep("select")} data-testid="button-back-to-select">
                  Back
                </Button>
                <Button
                  onClick={handleConfirmImport}
                  disabled={validRows.length === 0 || importMutation.isPending}
                  variant={mode === "replace" ? "destructive" : "default"}
                  data-testid="button-confirm-import"
                >
                  {importMutation.isPending
                    ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Importing…</>
                    : <>
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        {mode === "replace" ? "Replace & Import" : "Import"} {validRows.length} Row(s)
                      </>}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={replaceConfirmOpen} onOpenChange={setReplaceConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Replace All Bulk-Imported Records?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will delete all previously bulk-imported disease case records (those tagged as "[[bulk-import]]") and replace them with the {validRows.length} new row(s) from your file(s). Manually entered records will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-replace">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { setReplaceConfirmOpen(false); importMutation.mutate({ rows: validRows, replace: true }); }}
              data-testid="button-confirm-replace"
            >
              Yes, Replace All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
