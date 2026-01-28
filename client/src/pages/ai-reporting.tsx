import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Bot, Sparkles, RefreshCw, TrendingUp, Users, Baby, Heart, AlertTriangle, Activity, Target, MapPin, Shield, Clock, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface RiskScore {
  barangay: string;
  overallRisk: "HIGH" | "MEDIUM" | "LOW";
  immunizationRisk: "HIGH" | "MEDIUM" | "LOW";
  prenatalRisk: "HIGH" | "MEDIUM" | "LOW";
  seniorCareRisk: "HIGH" | "MEDIUM" | "LOW";
  diseaseRisk: "HIGH" | "MEDIUM" | "LOW";
  tbRisk: "HIGH" | "MEDIUM" | "LOW";
  riskFactors: string[];
}

interface Prediction {
  category: string;
  forecast: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  timeframe: string;
  recommendation: string;
}

interface TrendData {
  immunizationCoverageRate: number;
  ttVaccinationRate: number;
  seniorMedComplianceRate: number;
  tbAdherenceRate: number;
  diseaseIncidenceRate: number;
}

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
  trends: TrendData;
  riskScores: RiskScore[];
  predictions: Prediction[];
  highRiskMothers: number;
  highRiskChildren: number;
  highRiskSeniors: number;
  criticalBarangays: string[];
}

interface InsightsResponse {
  insights: string[];
  stats: HealthStats;
}

function RiskBadge({ level }: { level: "HIGH" | "MEDIUM" | "LOW" }) {
  if (level === "HIGH") {
    return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">High Risk</Badge>;
  }
  if (level === "MEDIUM") {
    return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Medium</Badge>;
  }
  return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Low</Badge>;
}

function ConfidenceBadge({ level }: { level: "HIGH" | "MEDIUM" | "LOW" }) {
  const colors = {
    HIGH: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    MEDIUM: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    LOW: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  };
  return <Badge className={colors[level]}>{level} Confidence</Badge>;
}

function MetricCard({ label, value, target, icon: Icon, color }: { 
  label: string; 
  value: number; 
  target?: number; 
  icon: any; 
  color: string;
}) {
  const progressColor = value >= (target || 80) ? "bg-green-500" : value >= 60 ? "bg-yellow-500" : "bg-red-500";
  
  return (
    <Card className={`${color} border-opacity-30`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 opacity-70" />
            <span className="text-sm text-muted-foreground">{label}</span>
          </div>
          {target && <span className="text-xs text-muted-foreground">Target: {target}%</span>}
        </div>
        <div className="text-2xl font-bold">{value}%</div>
        {target && (
          <Progress value={value} className="h-1.5 mt-2" />
        )}
      </CardContent>
    </Card>
  );
}

export default function AIReporting() {
  const [streamedContent, setStreamedContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

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
  const trends = stats?.trends;
  const predictions = stats?.predictions || [];
  const riskScores = stats?.riskScores || [];
  const criticalBarangays = stats?.criticalBarangays || [];

  const highRiskBarangays = riskScores.filter(r => r.overallRisk === "HIGH");
  const mediumRiskBarangays = riskScores.filter(r => r.overallRisk === "MEDIUM");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Bot className="w-6 h-6 text-purple-400" />
            Predictive Health Analytics
          </h1>
          <p className="text-muted-foreground">AI-powered predictions, risk analysis, and health forecasting</p>
        </div>
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
            data-testid="button-stream-insights"
          >
            <Sparkles className={`w-4 h-4 mr-1 ${isStreaming ? "animate-pulse" : ""}`} />
            {isStreaming ? "Generating..." : "Stream Analysis"}
          </Button>
        </div>
      </div>

      {trends && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <MetricCard 
            label="Immunization" 
            value={trends.immunizationCoverageRate} 
            target={95} 
            icon={Shield} 
            color="bg-blue-500/10 border-blue-500" 
          />
          <MetricCard 
            label="TT Vaccination" 
            value={trends.ttVaccinationRate} 
            target={100} 
            icon={Heart} 
            color="bg-pink-500/10 border-pink-500" 
          />
          <MetricCard 
            label="Med Compliance" 
            value={trends.seniorMedComplianceRate} 
            target={90} 
            icon={Users} 
            color="bg-green-500/10 border-green-500" 
          />
          <MetricCard 
            label="TB Adherence" 
            value={trends.tbAdherenceRate} 
            target={95} 
            icon={Activity} 
            color="bg-orange-500/10 border-orange-500" 
          />
          <MetricCard 
            label="New Cases" 
            value={trends.diseaseIncidenceRate} 
            icon={AlertTriangle} 
            color="bg-red-500/10 border-red-500" 
          />
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="predictions" data-testid="tab-predictions">Predictions</TabsTrigger>
          <TabsTrigger value="risk-map" data-testid="tab-risk-map">Risk Analysis</TabsTrigger>
          <TabsTrigger value="insights" data-testid="tab-insights">AI Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <Card className="bg-pink-500/10 border-pink-500/30">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-pink-400" />
                    <span className="text-xs text-muted-foreground">Mothers</span>
                  </div>
                  <p className="text-xl font-bold mt-1" data-testid="stat-mothers">{stats.totalMothers}</p>
                  <p className="text-xs text-muted-foreground">{stats.highRiskMothers} high-risk</p>
                </CardContent>
              </Card>

              <Card className="bg-blue-500/10 border-blue-500/30">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <Baby className="w-4 h-4 text-blue-400" />
                    <span className="text-xs text-muted-foreground">Children</span>
                  </div>
                  <p className="text-xl font-bold mt-1" data-testid="stat-children">{stats.totalChildren}</p>
                  <p className="text-xs text-muted-foreground">{stats.highRiskChildren} high-risk</p>
                </CardContent>
              </Card>

              <Card className="bg-green-500/10 border-green-500/30">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <Heart className="w-4 h-4 text-green-400" />
                    <span className="text-xs text-muted-foreground">Seniors</span>
                  </div>
                  <p className="text-xl font-bold mt-1" data-testid="stat-seniors">{stats.totalSeniors}</p>
                  <p className="text-xs text-muted-foreground">{stats.highRiskSeniors} critical BP</p>
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
                  <p className="text-xs text-muted-foreground">{stats.tbPatientsWithMissedDoses} missed doses</p>
                </CardContent>
              </Card>

              <Card className="bg-yellow-500/10 border-yellow-500/30">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-yellow-400" />
                    <span className="text-xs text-muted-foreground">Critical Areas</span>
                  </div>
                  <p className="text-xl font-bold mt-1">{criticalBarangays.length}</p>
                  <p className="text-xs text-muted-foreground">barangays at risk</p>
                </CardContent>
              </Card>
            </div>
          )}

          {criticalBarangays.length > 0 && (
            <Card className="border-red-500/30 bg-red-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  Critical Barangays Requiring Immediate Attention
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {criticalBarangays.map((barangay) => (
                    <Badge key={barangay} className="bg-red-500/20 text-red-400 border-red-500/30">
                      {barangay}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {streamedContent && (
            <Card className="border-purple-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  Live AI Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-4 rounded-md bg-purple-500/5 border border-purple-500/20">
                  <p className="text-sm whitespace-pre-wrap">{streamedContent}</p>
                  {isStreaming && <span className="inline-block w-2 h-4 bg-purple-400 animate-pulse ml-1" />}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="predictions" className="space-y-4 mt-4">
          <div className="grid gap-4">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-32 bg-muted/50 rounded-md animate-pulse" />
                ))}
              </div>
            ) : predictions.length > 0 ? (
              predictions.map((prediction, idx) => (
                <Card key={idx} className="border-l-4 border-l-purple-500">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">{prediction.category}</Badge>
                          <ConfidenceBadge level={prediction.confidence} />
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {prediction.timeframe}
                          </div>
                        </div>
                        <h3 className="font-medium mb-2" data-testid={`prediction-${idx}-forecast`}>
                          {prediction.forecast}
                        </h3>
                        <div className="flex items-start gap-2 mt-3 p-3 rounded-md bg-green-500/5 border border-green-500/20">
                          <Target className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-muted-foreground">{prediction.recommendation}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Click "Refresh" to generate health predictions</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="risk-map" className="space-y-4 mt-4">
          <div className="grid md:grid-cols-3 gap-4">
            <Card className="border-red-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  High Risk ({highRiskBarangays.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-16 bg-muted/50 rounded-md animate-pulse" />
                    ))}
                  </div>
                ) : highRiskBarangays.length > 0 ? (
                  <div className="space-y-2">
                    {highRiskBarangays.map((r) => (
                      <div key={r.barangay} className="p-3 rounded-md bg-red-500/10 border border-red-500/20">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm">{r.barangay}</span>
                          <RiskBadge level={r.overallRisk} />
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {r.riskFactors.slice(0, 2).map((factor, i) => (
                            <span key={i} className="text-xs text-muted-foreground">
                              {factor}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No high-risk barangays</p>
                )}
              </CardContent>
            </Card>

            <Card className="border-yellow-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-400" />
                  Medium Risk ({mediumRiskBarangays.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-12 bg-muted/50 rounded-md animate-pulse" />
                    ))}
                  </div>
                ) : mediumRiskBarangays.length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {mediumRiskBarangays.map((r) => (
                      <div key={r.barangay} className="p-2 rounded-md bg-yellow-500/10 border border-yellow-500/20">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">{r.barangay}</span>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No medium-risk barangays</p>
                )}
              </CardContent>
            </Card>

            <Card className="border-green-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="w-4 h-4 text-green-400" />
                  Risk Categories
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                    <span className="text-sm">Immunization</span>
                    <span className="text-sm text-muted-foreground">
                      {riskScores.filter(r => r.immunizationRisk === "HIGH").length} high
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                    <span className="text-sm">Prenatal Care</span>
                    <span className="text-sm text-muted-foreground">
                      {riskScores.filter(r => r.prenatalRisk === "HIGH").length} high
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                    <span className="text-sm">Senior Health</span>
                    <span className="text-sm text-muted-foreground">
                      {riskScores.filter(r => r.seniorCareRisk === "HIGH").length} high
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                    <span className="text-sm">Disease Burden</span>
                    <span className="text-sm text-muted-foreground">
                      {riskScores.filter(r => r.diseaseRisk === "HIGH").length} high
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                    <span className="text-sm">TB Program</span>
                    <span className="text-sm text-muted-foreground">
                      {riskScores.filter(r => r.tbRisk === "HIGH").length} high
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4 mt-4">
          <Card className="border-purple-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                AI-Generated Health Insights
                <Badge variant="secondary" className="text-xs">Predictive Analytics</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-20 bg-muted/50 rounded-md animate-pulse" />
                  ))}
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
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">About Predictive Health Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This module uses advanced predictive analytics to forecast health trends and identify at-risk populations 
            across all 20 barangays in Placer municipality. The system analyzes prenatal care patterns, immunization 
            coverage, senior medication compliance, disease surveillance data, and TB treatment adherence to generate 
            actionable predictions and risk assessments. Forecasts include confidence levels and recommended timeframes 
            for intervention.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
