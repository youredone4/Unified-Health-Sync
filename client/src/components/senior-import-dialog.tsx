import { useState, useRef, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Upload, X, FileText, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, invalidateScopedQueries } from "@/lib/queryClient";
import { parseSeniorFile, type SeniorImportRow, type SeniorParseError } from "@/lib/seniorImportParser";
import { usePagination } from "@/hooks/use-pagination";
import TablePagination from "@/components/table-pagination";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = "select" | "preview";

export default function SeniorImportDialog({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("select");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [validRows, setValidRows] = useState<SeniorImportRow[]>([]);
  const [parseErrors, setParseErrors] = useState<SeniorParseError[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [mode, setMode] = useState<"append" | "replace">("append");
  const [replaceConfirmOpen, setReplaceConfirmOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"valid" | "errors">("valid");

  const validPagination = usePagination(validRows, 20);
  const errorPagination = usePagination(parseErrors, 20);

  function resetAll() {
    setStep("select");
    setSelectedFiles([]);
    setValidRows([]);
    setParseErrors([]);
    setTotalRows(0);
    setMode("append");
    setActiveTab("valid");
  }

  const handleClose = useCallback(() => {
    resetAll();
    onOpenChange(false);
  }, [onOpenChange]);

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(f => /\.(xls|xlsx|csv)$/i.test(f.name));
    if (files.length > 0) setSelectedFiles(prev => [...prev, ...files]);
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter(f => /\.(xls|xlsx|csv)$/i.test(f.name));
    if (files.length > 0) setSelectedFiles(prev => [...prev, ...files]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleParseFiles = async () => {
    if (selectedFiles.length === 0) return;
    setIsParsing(true);
    const allValid: SeniorImportRow[] = [];
    const allErrors: SeniorParseError[] = [];
    let total = 0;
    for (const file of selectedFiles) {
      try {
        const result = await parseSeniorFile(file);
        allValid.push(...result.valid);
        allErrors.push(...result.errors);
        total += result.totalRows;
      } catch {
        toast({ title: "Error reading file", description: file.name, variant: "destructive" });
      }
    }
    setValidRows(allValid);
    setParseErrors(allErrors);
    setTotalRows(total);
    setIsParsing(false);
    setStep("preview");
    setActiveTab(allValid.length > 0 ? "valid" : "errors");
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      const payload = validRows.map(r => ({
        firstName: r.firstName,
        lastName: r.lastName,
        age: r.age,
        barangay: r.barangay,
        dob: r.dob ?? undefined,
        sex: r.sex ?? undefined,
        civilStatus: r.civilStatus ?? undefined,
        addressLine: r.addressLine ?? undefined,
        seniorCitizenId: r.seniorCitizenId ?? undefined,
        phone: r.phone ?? undefined,
      }));
      const result = await apiRequest("POST", "/api/seniors/bulk-import", { rows: payload, replace: mode === "replace" });
      return result as { imported: number };
    },
    onSuccess: (data) => {
      invalidateScopedQueries("/api/seniors");
      toast({ title: "Import complete", description: `${data.imported} senior citizens imported successfully.` });
      handleClose();
    },
    onError: () => {
      toast({ title: "Import failed", description: "Could not import seniors. Please try again.", variant: "destructive" });
    },
  });

  const handleImport = () => {
    if (mode === "replace") {
      setReplaceConfirmOpen(true);
    } else {
      importMutation.mutate();
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Import Senior Citizens from AMOS Logs</DialogTitle>
            <DialogDescription>
              Upload XLS/XLSX files from the AMOS Senior Citizen Registry. Columns detected automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {step === "select" && (
              <>
                <div
                  className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleFileDrop}
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="dropzone-senior-import"
                >
                  <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm font-medium">Drop AMOS log files here or click to browse</p>
                  <p className="text-xs text-muted-foreground mt-1">Accepts .xls, .xlsx, .csv — multiple files allowed</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xls,.xlsx,.csv"
                    multiple
                    className="hidden"
                    onChange={handleFileChange}
                    data-testid="input-senior-import-file"
                  />
                </div>

                {selectedFiles.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">{selectedFiles.length} file{selectedFiles.length > 1 ? "s" : ""} selected</p>
                    {selectedFiles.map((f, i) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded border border-border bg-card text-sm">
                        <span className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          {f.name}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => { e.stopPropagation(); setSelectedFiles(prev => prev.filter((_, j) => j !== i)); }}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-sm font-medium">Import mode</p>
                  <RadioGroup value={mode} onValueChange={(v) => setMode(v as "append" | "replace")}>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="append" id="mode-append" data-testid="radio-mode-append" />
                      <Label htmlFor="mode-append">Append — add new seniors, keep existing records</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="replace" id="mode-replace" data-testid="radio-mode-replace" />
                      <Label htmlFor="mode-replace" className="text-orange-400">Replace all — delete all existing senior records first</Label>
                    </div>
                  </RadioGroup>
                </div>
              </>
            )}

            {step === "preview" && (
              <>
                <div className="flex gap-3 text-sm flex-wrap">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <strong>{validRows.length}</strong> valid
                  </span>
                  <span className="flex items-center gap-1">
                    <AlertCircle className="w-4 h-4 text-yellow-500" />
                    <strong>{parseErrors.length}</strong> skipped
                  </span>
                  <span className="text-muted-foreground">{totalRows} total rows across {selectedFiles.length} file(s)</span>
                </div>

                <div className="flex gap-2 border-b border-border">
                  {(["valid", "errors"] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-3 py-1.5 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                    >
                      {tab === "valid" ? `Valid Records (${validRows.length})` : `Skipped (${parseErrors.length})`}
                    </button>
                  ))}
                </div>

                {activeTab === "valid" && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2 px-2">Name</th>
                          <th className="text-left py-2 px-2">Barangay</th>
                          <th className="text-left py-2 px-2">Age</th>
                          <th className="text-left py-2 px-2">Sex</th>
                          <th className="text-left py-2 px-2">Civil Status</th>
                          <th className="text-left py-2 px-2">Senior ID</th>
                          <th className="text-left py-2 px-2">Address</th>
                        </tr>
                      </thead>
                      <tbody>
                        {validPagination.pagedItems.map((r, i) => (
                          <tr key={i} className="border-b border-border/40">
                            <td className="py-1.5 px-2 font-medium">{r.firstName} {r.lastName}</td>
                            <td className="py-1.5 px-2">{r.barangay}</td>
                            <td className="py-1.5 px-2">{r.age}</td>
                            <td className="py-1.5 px-2">{r.sex ?? "-"}</td>
                            <td className="py-1.5 px-2">{r.civilStatus ?? "-"}</td>
                            <td className="py-1.5 px-2">{r.seniorCitizenId ?? "-"}</td>
                            <td className="py-1.5 px-2">{r.addressLine ?? "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <TablePagination pagination={validPagination} />
                  </div>
                )}

                {activeTab === "errors" && (
                  <div className="space-y-1">
                    {parseErrors.length === 0
                      ? <p className="text-sm text-muted-foreground">No errors</p>
                      : errorPagination.pagedItems.map((e, i) => (
                          <div key={i} className="flex gap-2 text-xs p-2 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                            <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                            <span><strong>{e.file}</strong> row {e.row}: {e.reason}</span>
                          </div>
                        ))
                    }
                    {parseErrors.length > 0 && <TablePagination pagination={errorPagination} />}
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter className="flex gap-2 pt-4 border-t border-border">
            {step === "select" ? (
              <>
                <Button variant="outline" onClick={handleClose}>Cancel</Button>
                <Button
                  onClick={handleParseFiles}
                  disabled={selectedFiles.length === 0 || isParsing}
                  data-testid="button-parse-senior-files"
                >
                  {isParsing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Reading...</> : "Preview Import"}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setStep("select")}>Back</Button>
                <Button
                  onClick={handleImport}
                  disabled={validRows.length === 0 || importMutation.isPending}
                  data-testid="button-confirm-senior-import"
                >
                  {importMutation.isPending
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importing...</>
                    : `Import ${validRows.length} Seniors`}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={replaceConfirmOpen} onOpenChange={setReplaceConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace all senior records?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete ALL existing senior citizen records and replace them with {validRows.length} records from your files. Medication history and BP records will also be lost. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => { setReplaceConfirmOpen(false); importMutation.mutate(); }}
            >
              Yes, Replace All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
