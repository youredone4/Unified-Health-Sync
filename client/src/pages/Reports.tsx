import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, FileDown, Search } from "lucide-react";

export default function Reports() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAskAI = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Fake AI delay
    setTimeout(() => {
      setResult(`
        Based on current data analysis for Barangay San Jose:
        
        1. **Immunization Gap**: There is a 15% drop in Penta-3 completion rates compared to last month.
        2. **Supply Alert**: Paracetamol stocks are critically low (below safety stock level).
        3. **Prenatal Care**: 3 mothers are overdue for TT2. Recommended action: Home visit for scheduling.
        
        Recommendation: Prioritize vaccination catch-up drive next Tuesday.
      `);
      setLoading(false);
    }, 1500);
  };

  return (
    <Layout title="Reports & AI Analytics" subtitle="Data Export and Intelligent Insights">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Export Section */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-display uppercase tracking-wide">Monthly Reports</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border">
              <div>
                <p className="font-bold">FHSIS Monthly Consolidation</p>
                <p className="text-sm text-muted-foreground">PDF Format • 2.4 MB</p>
              </div>
              <Button variant="outline"><FileDown className="w-4 h-4 mr-2" /> Download</Button>
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border">
              <div>
                <p className="font-bold">Vaccination Registry Export</p>
                <p className="text-sm text-muted-foreground">Excel Format • 1.1 MB</p>
              </div>
              <Button variant="outline"><FileDown className="w-4 h-4 mr-2" /> Download</Button>
            </div>
          </CardContent>
        </Card>

        {/* AI RAG Demo Section */}
        <Card className="bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
          <CardHeader>
            <CardTitle className="font-display uppercase tracking-wide flex items-center gap-2 text-primary">
              <Bot className="w-6 h-6" /> Health AI Assistant
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAskAI} className="flex gap-2 mb-6">
              <Input 
                placeholder="Ask about health trends (e.g., 'Summary of Brgy San Jose')" 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="bg-background"
              />
              <Button type="submit" disabled={loading}>
                {loading ? "Analyzing..." : <Search className="w-4 h-4" />}
              </Button>
            </form>

            {result && (
              <div className="p-4 rounded-lg bg-background/80 border border-primary/20 animate-in fade-in slide-in-from-bottom-2">
                <div className="prose prose-invert prose-sm max-w-none">
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
                    {result}
                  </pre>
                </div>
              </div>
            )}

            {!result && !loading && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Try asking: "Which barangay has the most overdue vaccines?"
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
