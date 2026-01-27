import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bot, Sparkles, RefreshCw, TrendingUp, Users, Baby, Heart, AlertTriangle, Activity } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface HealthStats {
  totalMothers: number;
  activeMothers: number;
  deliveredMothers: number;
  mothersWithNoTT: number;
  mothersWithCompleteTT: number;
  totalChildren: number;
  childrenUnder1: number;
  childrenWithCompletePrimaryVaccines: number;
  childrenMissingVaccines: number;
  lowBirthWeightChildren: number;
  totalSeniors: number;
  seniorsWithMedsDue: number;
  seniorsWithHighBP: number;
  totalDiseaseCases: number;
  newDiseaseCases: number;
  totalTBPatients: number;
  tbPatientsOngoing: number;
  tbPatientsWithMissedDoses: number;
  topDiseases: { condition: string; count: number }[];
}

interface InsightsResponse {
  insights: string[];
  stats: HealthStats;
}

export default function AIReporting() {
  const [streamedContent, setStreamedContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  const { data, isLoading, refetch, isFetching } = useQuery<InsightsResponse>({
    queryKey: ["/api/ai/insights"],
    staleTime: 5 * 60 * 1000,
  });

  const generateStreamingInsights = useCallback(async () => {
    setIsStreaming(true);
    setStreamedContent("");

    try {
      const response = await fetch("/api/ai/insights/stream", {
        credentials: "include",
      });

      if (!response.ok) throw new Error("Failed to stream insights");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.content) {
              setStreamedContent((prev) => prev + event.content);
            }
            if (event.done) {
              setIsStreaming(false);
            }
          } catch {}
        }
      }
    } catch (error) {
      console.error("Streaming error:", error);
    } finally {
      setIsStreaming(false);
    }
  }, []);

  const stats = data?.stats;
  const insights = data?.insights || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <Bot className="w-6 h-6 text-purple-400" />
          AI Health Insights
        </h1>
        <p className="text-muted-foreground">AI-powered analysis and recommendations based on your health data</p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <Card className="bg-pink-500/10 border-pink-500/30">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-pink-400" />
                <span className="text-xs text-muted-foreground">Mothers</span>
              </div>
              <p className="text-xl font-bold mt-1" data-testid="stat-mothers">{stats.totalMothers}</p>
              <p className="text-xs text-muted-foreground">{stats.activeMothers} active</p>
            </CardContent>
          </Card>

          <Card className="bg-blue-500/10 border-blue-500/30">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Baby className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-muted-foreground">Children</span>
              </div>
              <p className="text-xl font-bold mt-1" data-testid="stat-children">{stats.totalChildren}</p>
              <p className="text-xs text-muted-foreground">{stats.childrenMissingVaccines} need vaccines</p>
            </CardContent>
          </Card>

          <Card className="bg-green-500/10 border-green-500/30">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-green-400" />
                <span className="text-xs text-muted-foreground">Seniors</span>
              </div>
              <p className="text-xl font-bold mt-1" data-testid="stat-seniors">{stats.totalSeniors}</p>
              <p className="text-xs text-muted-foreground">{stats.seniorsWithMedsDue} meds due</p>
            </CardContent>
          </Card>

          <Card className="bg-orange-500/10 border-orange-500/30">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-400" />
                <span className="text-xs text-muted-foreground">Disease Cases</span>
              </div>
              <p className="text-xl font-bold mt-1" data-testid="stat-diseases">{stats.totalDiseaseCases}</p>
              <p className="text-xs text-muted-foreground">{stats.newDiseaseCases} new</p>
            </CardContent>
          </Card>

          <Card className="bg-red-500/10 border-red-500/30">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-red-400" />
                <span className="text-xs text-muted-foreground">TB Patients</span>
              </div>
              <p className="text-xl font-bold mt-1" data-testid="stat-tb">{stats.totalTBPatients}</p>
              <p className="text-xs text-muted-foreground">{stats.tbPatientsOngoing} ongoing</p>
            </CardContent>
          </Card>

          <Card className="bg-yellow-500/10 border-yellow-500/30">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-yellow-400" />
                <span className="text-xs text-muted-foreground">Top Disease</span>
              </div>
              <p className="text-sm font-bold mt-1">{stats.topDiseases[0]?.condition || "N/A"}</p>
              <p className="text-xs text-muted-foreground">{stats.topDiseases[0]?.count || 0} cases</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="border-purple-500/30">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              AI-Generated Insights
              <Badge variant="secondary" className="text-xs">RAG</Badge>
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isFetching}
                data-testid="button-refresh-insights"
              >
                <RefreshCw className={`w-4 h-4 mr-1 ${isFetching ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={generateStreamingInsights}
                disabled={isStreaming}
                className="gap-2"
                data-testid="button-stream-insights"
              >
                <Sparkles className={`w-4 h-4 ${isStreaming ? "animate-pulse" : ""}`} />
                {isStreaming ? "Generating..." : "Stream Analysis"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 bg-muted/50 rounded-md animate-pulse" />
              ))}
            </div>
          ) : streamedContent ? (
            <div className="p-4 rounded-md bg-purple-500/5 border border-purple-500/20">
              <p className="text-sm whitespace-pre-wrap">{streamedContent}</p>
              {isStreaming && <span className="inline-block w-2 h-4 bg-purple-400 animate-pulse ml-1" />}
            </div>
          ) : insights.length > 0 ? (
            insights.map((insight, idx) => (
              <div key={idx} className="p-4 rounded-md bg-purple-500/5 border border-purple-500/20">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-medium text-purple-400">{idx + 1}</span>
                  </div>
                  <p className="text-sm" data-testid={`insight-${idx}`}>{insight}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Bot className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Click "Refresh" to generate AI insights from your health data</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">About AI Health Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This feature uses Retrieval-Augmented Generation (RAG) to analyze your real health program data 
            and generate actionable insights. The AI examines prenatal care statistics, immunization coverage, 
            senior medication compliance, disease surveillance patterns, and TB treatment adherence across all 
            20 barangays to provide targeted recommendations for your Municipal Health Office.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
