import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bot, Sparkles } from "lucide-react";

export default function AIReporting() {
  const sampleInsights = [
    "Bugas-bugas has the highest number of overdue TT vaccinations (2 mothers). Consider scheduling a community outreach visit.",
    "BCG stock is depleted in San Isidro. Transfer surplus from Poblacion (45 units available) to prevent missed vaccinations.",
    "3 children are flagged for underweight risk in Banban. Recommend nutritional counseling sessions this month.",
    "Senior medication pickup compliance is at 75%. SMS reminders have shown 40% improvement in pickup rates in similar barangays."
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <Bot className="w-6 h-6 text-purple-400" />
          AI Reporting
        </h1>
        <p className="text-muted-foreground">AI-powered insights and recommendations</p>
      </div>

      <Card className="border-purple-500/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            AI Insights (Demo)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {sampleInsights.map((insight, idx) => (
            <div key={idx} className="p-4 rounded-md bg-purple-500/5 border border-purple-500/20">
              <p className="text-sm">{insight}</p>
            </div>
          ))}
          <Button variant="outline" className="gap-2 mt-4" data-testid="button-generate-insights">
            <Sparkles className="w-4 h-4" /> Generate New Insights
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Note</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This is a demo of AI-powered reporting. In production, this would connect to an AI model that analyzes 
            health data patterns and generates actionable recommendations for barangay health workers.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
