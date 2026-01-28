import OpenAI from "openai";
import { db } from "./db";
import { mothers, children, seniors, diseaseCases, tbPatients, barangays, inventory } from "@shared/schema";
import { eq, sql, and, gte, lte, count } from "drizzle-orm";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

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
  barangayBreakdown: Record<string, {
    mothers: number;
    children: number;
    seniors: number;
    diseases: number;
    tb: number;
  }>;
  topDiseases: { condition: string; count: number }[];
}

interface TrendData {
  immunizationCoverageRate: number;
  ttVaccinationRate: number;
  seniorMedComplianceRate: number;
  tbAdherenceRate: number;
  diseaseIncidenceRate: number;
  recentDiseaseCount: number;
  previousDiseaseCount: number;
  diseaseTrendDirection: "INCREASING" | "STABLE" | "DECREASING";
}

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

interface EnhancedHealthStats extends HealthStats {
  trends: TrendData;
  riskScores: RiskScore[];
  predictions: Prediction[];
  highRiskMothers: number;
  highRiskChildren: number;
  highRiskSeniors: number;
  criticalBarangays: string[];
}

function calculateRiskLevel(value: number, lowThreshold: number, highThreshold: number): "HIGH" | "MEDIUM" | "LOW" {
  if (value >= highThreshold) return "HIGH";
  if (value >= lowThreshold) return "MEDIUM";
  return "LOW";
}

async function getHealthStatistics(): Promise<HealthStats> {
  const today = new Date().toISOString().split("T")[0];
  
  const allBarangays = await db.select().from(barangays);
  const barangayNames = allBarangays.map(b => b.name);
  
  const allMothers = await db.select().from(mothers);
  const allChildren = await db.select().from(children);
  const allSeniors = await db.select().from(seniors);
  const allDiseases = await db.select().from(diseaseCases);
  const allTB = await db.select().from(tbPatients);
  
  const activeMothers = allMothers.filter(m => m.status === "active");
  const deliveredMothers = allMothers.filter(m => m.status === "delivered");
  const mothersWithNoTT = allMothers.filter(m => !m.tt1Date);
  const mothersWithCompleteTT = allMothers.filter(m => m.tt5Date);
  
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const childrenUnder1 = allChildren.filter(c => new Date(c.dob) >= oneYearAgo);
  
  const childrenWithCompletePrimaryVaccines = allChildren.filter(c => {
    const v = c.vaccines as any || {};
    return v.bcg && v.hepB && v.penta1 && v.penta2 && v.penta3 && v.opv1 && v.opv2 && v.opv3;
  });
  
  const childrenMissingVaccines = allChildren.filter(c => {
    const v = c.vaccines as any || {};
    const ageMonths = Math.floor((Date.now() - new Date(c.dob).getTime()) / (1000 * 60 * 60 * 24 * 30));
    if (ageMonths >= 2 && !v.penta1) return true;
    if (ageMonths >= 3 && !v.penta2) return true;
    if (ageMonths >= 4 && !v.penta3) return true;
    if (ageMonths >= 9 && !v.mr1) return true;
    return false;
  });
  
  const lowBirthWeightChildren = allChildren.filter(c => c.birthWeightCategory === "low");
  
  const seniorsWithMedsDue = allSeniors.filter(s => {
    if (!s.nextPickupDate) return false;
    return new Date(s.nextPickupDate) <= new Date(today);
  });
  
  const seniorsWithHighBP = allSeniors.filter(s => {
    if (!s.lastBP) return false;
    const [systolic] = s.lastBP.split("/").map(Number);
    return systolic >= 140;
  });
  
  const newDiseaseCases = allDiseases.filter(d => d.status === "New");
  
  const tbPatientsOngoing = allTB.filter(t => t.outcomeStatus === "Ongoing");
  const tbPatientsWithMissedDoses = allTB.filter(t => (t.missedDosesCount || 0) > 2);
  
  const barangayBreakdown: HealthStats["barangayBreakdown"] = {};
  for (const name of barangayNames) {
    barangayBreakdown[name] = {
      mothers: allMothers.filter(m => m.barangay === name).length,
      children: allChildren.filter(c => c.barangay === name).length,
      seniors: allSeniors.filter(s => s.barangay === name).length,
      diseases: allDiseases.filter(d => d.barangay === name).length,
      tb: allTB.filter(t => t.barangay === name).length,
    };
  }
  
  const diseaseCount: Record<string, number> = {};
  for (const d of allDiseases) {
    diseaseCount[d.condition] = (diseaseCount[d.condition] || 0) + 1;
  }
  const topDiseases = Object.entries(diseaseCount)
    .map(([condition, count]) => ({ condition, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  
  return {
    totalMothers: allMothers.length,
    activeMothers: activeMothers.length,
    deliveredMothers: deliveredMothers.length,
    mothersWithNoTT: mothersWithNoTT.length,
    mothersWithCompleteTT: mothersWithCompleteTT.length,
    totalChildren: allChildren.length,
    childrenUnder1: childrenUnder1.length,
    childrenWithCompletePrimaryVaccines: childrenWithCompletePrimaryVaccines.length,
    childrenMissingVaccines: childrenMissingVaccines.length,
    lowBirthWeightChildren: lowBirthWeightChildren.length,
    totalSeniors: allSeniors.length,
    seniorsWithMedsDue: seniorsWithMedsDue.length,
    seniorsWithHighBP: seniorsWithHighBP.length,
    totalDiseaseCases: allDiseases.length,
    newDiseaseCases: newDiseaseCases.length,
    totalTBPatients: allTB.length,
    tbPatientsOngoing: tbPatientsOngoing.length,
    tbPatientsWithMissedDoses: tbPatientsWithMissedDoses.length,
    barangayBreakdown,
    topDiseases,
  };
}

async function getEnhancedHealthStatistics(): Promise<EnhancedHealthStats> {
  const baseStats = await getHealthStatistics();
  const today = new Date();
  
  const allMothers = await db.select().from(mothers);
  const allChildren = await db.select().from(children);
  const allSeniors = await db.select().from(seniors);
  const allDiseases = await db.select().from(diseaseCases);
  const allTB = await db.select().from(tbPatients);
  const allBarangays = await db.select().from(barangays);
  const barangayNames = allBarangays.map(b => b.name);
  
  const immunizationCoverageRate = baseStats.totalChildren > 0 
    ? Math.round((baseStats.childrenWithCompletePrimaryVaccines / baseStats.totalChildren) * 100) 
    : 0;
  
  const ttVaccinationRate = baseStats.totalMothers > 0 
    ? Math.round(((baseStats.totalMothers - baseStats.mothersWithNoTT) / baseStats.totalMothers) * 100) 
    : 0;
  
  const seniorMedComplianceRate = baseStats.totalSeniors > 0 
    ? Math.round(((baseStats.totalSeniors - baseStats.seniorsWithMedsDue) / baseStats.totalSeniors) * 100) 
    : 0;
  
  const tbAdherenceRate = baseStats.totalTBPatients > 0 
    ? Math.round(((baseStats.totalTBPatients - baseStats.tbPatientsWithMissedDoses) / baseStats.totalTBPatients) * 100) 
    : 0;
  
  const diseaseIncidenceRate = Math.round((baseStats.newDiseaseCases / Math.max(1, baseStats.totalDiseaseCases)) * 100);
  
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  
  const recentDiseases = allDiseases.filter(d => {
    if (!d.dateReported) return false;
    return new Date(d.dateReported) >= thirtyDaysAgo;
  });
  const previousDiseases = allDiseases.filter(d => {
    if (!d.dateReported) return false;
    const reportDate = new Date(d.dateReported);
    return reportDate >= sixtyDaysAgo && reportDate < thirtyDaysAgo;
  });
  
  const recentDiseaseCount = recentDiseases.length;
  const previousDiseaseCount = previousDiseases.length;
  
  let diseaseTrendDirection: "INCREASING" | "STABLE" | "DECREASING" = "STABLE";
  if (previousDiseaseCount > 0) {
    const changePercent = ((recentDiseaseCount - previousDiseaseCount) / previousDiseaseCount) * 100;
    if (changePercent > 20) diseaseTrendDirection = "INCREASING";
    else if (changePercent < -20) diseaseTrendDirection = "DECREASING";
  }
  
  const trends: TrendData = {
    immunizationCoverageRate,
    ttVaccinationRate,
    seniorMedComplianceRate,
    tbAdherenceRate,
    diseaseIncidenceRate,
    recentDiseaseCount,
    previousDiseaseCount,
    diseaseTrendDirection,
  };
  
  const highRiskMothers = allMothers.filter(m => {
    if (!m.tt1Date && m.status === "active") return true;
    const gaWeeks = m.gaWeeks || 0;
    if (gaWeeks >= 28 && !m.tt2Date) return true;
    if (gaWeeks >= 36 && !m.tt3Date) return true;
    const hasLowBirthWeightRisk = m.age && (m.age < 18 || m.age > 35);
    if (hasLowBirthWeightRisk && m.status === "active") return true;
    return false;
  }).length;
  
  const highRiskChildren = allChildren.filter(c => {
    const v = c.vaccines as any || {};
    const ageMonths = Math.floor((Date.now() - new Date(c.dob).getTime()) / (1000 * 60 * 60 * 24 * 30));
    if (c.birthWeightCategory === "low") return true;
    if (ageMonths >= 9 && !v.mr1) return true;
    if (ageMonths >= 4 && !v.penta3) return true;
    return false;
  }).length;
  
  const highRiskSeniors = allSeniors.filter(s => {
    if (!s.lastBP) return false;
    const [systolic, diastolic] = s.lastBP.split("/").map(Number);
    if (systolic >= 160 || diastolic >= 100) return true;
    return false;
  }).length;
  
  const riskScores: RiskScore[] = barangayNames.map(barangay => {
    const data = baseStats.barangayBreakdown[barangay] || { mothers: 0, children: 0, seniors: 0, diseases: 0, tb: 0 };
    
    const barangayMothers = allMothers.filter(m => m.barangay === barangay);
    const barangayChildren = allChildren.filter(c => c.barangay === barangay);
    const barangaySeniors = allSeniors.filter(s => s.barangay === barangay);
    const barangayTB = allTB.filter(t => t.barangay === barangay);
    
    const noTTRate = barangayMothers.length > 0 
      ? barangayMothers.filter(m => !m.tt1Date).length / barangayMothers.length 
      : 0;
    
    const missingVaccineRate = barangayChildren.length > 0 
      ? barangayChildren.filter(c => {
          const v = c.vaccines as any || {};
          const ageMonths = Math.floor((Date.now() - new Date(c.dob).getTime()) / (1000 * 60 * 60 * 24 * 30));
          return (ageMonths >= 2 && !v.penta1) || (ageMonths >= 9 && !v.mr1);
        }).length / barangayChildren.length 
      : 0;
    
    const highBPRate = barangaySeniors.length > 0 
      ? barangaySeniors.filter(s => {
          if (!s.lastBP) return false;
          const [systolic] = s.lastBP.split("/").map(Number);
          return systolic >= 140;
        }).length / barangaySeniors.length 
      : 0;
    
    const missedDoseRate = barangayTB.length > 0 
      ? barangayTB.filter(t => (t.missedDosesCount || 0) > 2).length / barangayTB.length 
      : 0;
    
    const diseaseRate = data.diseases / Math.max(1, baseStats.totalDiseaseCases) * 100;
    
    const riskFactors: string[] = [];
    const immunizationRisk = calculateRiskLevel(missingVaccineRate * 100, 30, 50);
    const prenatalRisk = calculateRiskLevel(noTTRate * 100, 20, 40);
    const seniorCareRisk = calculateRiskLevel(highBPRate * 100, 40, 60);
    const diseaseRisk = calculateRiskLevel(diseaseRate, 5, 10);
    const tbRisk = calculateRiskLevel(missedDoseRate * 100, 30, 50);
    
    if (immunizationRisk === "HIGH") riskFactors.push("High rate of missing vaccines");
    if (prenatalRisk === "HIGH") riskFactors.push("Many mothers without TT vaccination");
    if (seniorCareRisk === "HIGH") riskFactors.push("High uncontrolled hypertension");
    if (diseaseRisk === "HIGH") riskFactors.push("Above-average disease incidence");
    if (tbRisk === "HIGH") riskFactors.push("Poor TB treatment adherence");
    
    const riskCount = [immunizationRisk, prenatalRisk, seniorCareRisk, diseaseRisk, tbRisk]
      .filter(r => r === "HIGH").length;
    
    let overallRisk: "HIGH" | "MEDIUM" | "LOW" = "LOW";
    if (riskCount >= 3) overallRisk = "HIGH";
    else if (riskCount >= 1) overallRisk = "MEDIUM";
    
    return {
      barangay,
      overallRisk,
      immunizationRisk,
      prenatalRisk,
      seniorCareRisk,
      diseaseRisk,
      tbRisk,
      riskFactors,
    };
  });
  
  const criticalBarangays = riskScores
    .filter(r => r.overallRisk === "HIGH")
    .map(r => r.barangay);
  
  const predictions: Prediction[] = [];
  
  if (immunizationCoverageRate < 80) {
    predictions.push({
      category: "Immunization",
      forecast: `At current rates, immunization coverage will remain below 80% target. ${baseStats.childrenMissingVaccines} children need immediate catch-up.`,
      confidence: "HIGH",
      timeframe: "Next 3 months",
      recommendation: "Deploy mobile vaccination teams to underserved barangays. Prioritize: " + 
        riskScores.filter(r => r.immunizationRisk === "HIGH").slice(0, 3).map(r => r.barangay).join(", "),
    });
  }
  
  if (baseStats.mothersWithNoTT > baseStats.totalMothers * 0.1) {
    predictions.push({
      category: "Prenatal Care",
      forecast: `${Math.round((baseStats.mothersWithNoTT / baseStats.totalMothers) * 100)}% of mothers lack TT protection. Risk of neonatal tetanus remains elevated.`,
      confidence: "MEDIUM",
      timeframe: "Next 6 months",
      recommendation: "Integrate TT vaccination into all prenatal visits. Focus on barangays with lowest coverage.",
    });
  }
  
  if (baseStats.seniorsWithHighBP > baseStats.totalSeniors * 0.5) {
    predictions.push({
      category: "Senior Health",
      forecast: `${Math.round((baseStats.seniorsWithHighBP / baseStats.totalSeniors) * 100)}% of seniors have uncontrolled hypertension. Cardiovascular event risk is elevated.`,
      confidence: "HIGH",
      timeframe: "Ongoing",
      recommendation: "Implement monthly BP monitoring and medication review. Consider home visit program for high-risk seniors.",
    });
  }
  
  if (baseStats.tbPatientsWithMissedDoses > baseStats.totalTBPatients * 0.3) {
    predictions.push({
      category: "TB Program",
      forecast: `${Math.round((baseStats.tbPatientsWithMissedDoses / baseStats.totalTBPatients) * 100)}% of TB patients have missed doses. Risk of treatment failure and drug resistance.`,
      confidence: "HIGH",
      timeframe: "Immediate",
      recommendation: "Strengthen DOTS supervision. Assign community health workers for daily observed therapy.",
    });
  }
  
  const topDisease = baseStats.topDiseases[0];
  if (topDisease && topDisease.count > 20) {
    const trendConfidence = diseaseTrendDirection === "INCREASING" ? "HIGH" : "MEDIUM";
    const trendWarning = diseaseTrendDirection === "INCREASING" 
      ? ` Disease cases are INCREASING (${recentDiseaseCount} in last 30 days vs ${previousDiseaseCount} previously).`
      : diseaseTrendDirection === "DECREASING"
      ? ` Cases are decreasing (${recentDiseaseCount} recent vs ${previousDiseaseCount} previous).`
      : "";
    predictions.push({
      category: "Disease Surveillance",
      forecast: `${topDisease.condition} is the leading condition with ${topDisease.count} cases.${trendWarning} Potential for community outbreak.`,
      confidence: trendConfidence,
      timeframe: diseaseTrendDirection === "INCREASING" ? "Immediate" : "Next 1-2 months",
      recommendation: diseaseTrendDirection === "INCREASING" 
        ? "URGENT: Deploy outbreak response team. Increase surveillance and case investigation immediately."
        : "Enhance surveillance and case investigation. Prepare outbreak response supplies.",
    });
  }
  
  if (diseaseTrendDirection === "INCREASING") {
    predictions.push({
      category: "Outbreak Alert",
      forecast: `Disease cases increased from ${previousDiseaseCount} (previous 30 days) to ${recentDiseaseCount} (last 30 days). This ${Math.round(((recentDiseaseCount - previousDiseaseCount) / Math.max(1, previousDiseaseCount)) * 100)}% increase signals potential outbreak conditions.`,
      confidence: "HIGH",
      timeframe: "Next 2-4 weeks",
      recommendation: "Activate disease surveillance protocols. Increase reporting frequency. Prepare medical supplies for surge capacity.",
    });
  }
  
  if (criticalBarangays.length > 0) {
    predictions.push({
      category: "Resource Allocation",
      forecast: `${criticalBarangays.length} barangays show high risk across multiple health indicators.`,
      confidence: "HIGH",
      timeframe: "Next quarter",
      recommendation: `Prioritize resource deployment to: ${criticalBarangays.slice(0, 5).join(", ")}`,
    });
  }
  
  return {
    ...baseStats,
    trends,
    riskScores,
    predictions,
    highRiskMothers,
    highRiskChildren,
    highRiskSeniors,
    criticalBarangays,
  };
}

export async function generateHealthInsights(): Promise<{ insights: string[]; stats: EnhancedHealthStats }> {
  const stats = await getEnhancedHealthStatistics();
  
  const prompt = `You are a public health analyst assistant for a Municipal Health Office in the Philippines.
Based on the following health statistics and risk analysis for Placer municipality (20 barangays), generate 6-8 specific, actionable insights including predictions and forecasts.

HEALTH STATISTICS:
- Total Pregnant Mothers: ${stats.totalMothers} (${stats.activeMothers} active, ${stats.deliveredMothers} delivered)
- Mothers without any TT vaccination: ${stats.mothersWithNoTT}
- Mothers with complete TT (5 doses): ${stats.mothersWithCompleteTT}
- High-risk mothers requiring attention: ${stats.highRiskMothers}
- Total Children: ${stats.totalChildren} (${stats.childrenUnder1} under 1 year old)
- Children with complete primary vaccines: ${stats.childrenWithCompletePrimaryVaccines}
- Children missing age-appropriate vaccines: ${stats.childrenMissingVaccines}
- High-risk children: ${stats.highRiskChildren}
- Low birth weight children: ${stats.lowBirthWeightChildren}
- Total Seniors: ${stats.totalSeniors}
- Seniors with medication pickup due: ${stats.seniorsWithMedsDue}
- Seniors with high BP (>=140 systolic): ${stats.seniorsWithHighBP}
- High-risk seniors (BP >=160/100): ${stats.highRiskSeniors}
- Total Disease Cases: ${stats.totalDiseaseCases} (${stats.newDiseaseCases} new)
- Top diseases: ${stats.topDiseases.map(d => `${d.condition}: ${d.count}`).join(", ")}
- Total TB Patients: ${stats.totalTBPatients} (${stats.tbPatientsOngoing} ongoing treatment)
- TB Patients with >2 missed doses: ${stats.tbPatientsWithMissedDoses}

PERFORMANCE METRICS:
- Immunization Coverage Rate: ${stats.trends.immunizationCoverageRate}% (Target: 95%)
- TT Vaccination Rate: ${stats.trends.ttVaccinationRate}% (Target: 100%)
- Senior Medication Compliance: ${stats.trends.seniorMedComplianceRate}%
- TB Treatment Adherence: ${stats.trends.tbAdherenceRate}%
- New Disease Incidence: ${stats.trends.diseaseIncidenceRate}%

HIGH-RISK BARANGAYS:
${stats.riskScores
  .filter(r => r.overallRisk === "HIGH")
  .map(r => `${r.barangay}: ${r.riskFactors.join(", ")}`)
  .join("\n") || "None identified"}

BARANGAY BREAKDOWN (top 10 by patient load):
${Object.entries(stats.barangayBreakdown)
  .sort((a, b) => (b[1].mothers + b[1].children + b[1].seniors) - (a[1].mothers + a[1].children + a[1].seniors))
  .slice(0, 10)
  .map(([name, data]) => `${name}: ${data.mothers} mothers, ${data.children} children, ${data.seniors} seniors, ${data.diseases} disease cases, ${data.tb} TB`)
  .join("\n")}

Generate insights that include:
1. Current situation analysis with specific numbers
2. Predictive forecasts (what will likely happen in next 3-6 months if no intervention)
3. Risk alerts for high-priority areas
4. Specific recommendations with target barangays
5. Resource allocation priorities
6. Early warning indicators to monitor

Format each insight as a single paragraph. Be specific with numbers, barangay names, and timeframes.
Return a JSON object with an "insights" array containing string insights.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_completion_tokens: 3000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content || '{"insights":[]}';
    const parsed = JSON.parse(content);
    const insights = Array.isArray(parsed) ? parsed : (parsed.insights || []);
    
    return { insights, stats };
  } catch (error) {
    console.error("Error generating AI insights:", error);
    return {
      insights: [
        `PREDICTION: With ${stats.childrenMissingVaccines} children behind on vaccinations (${100 - stats.trends.immunizationCoverageRate}% gap to target), outbreaks of vaccine-preventable diseases are likely within 6 months without intervention. Priority: ${stats.criticalBarangays.slice(0, 3).join(", ")}.`,
        `RISK ALERT: ${stats.mothersWithNoTT} pregnant mothers have not received any TT vaccination (${100 - stats.trends.ttVaccinationRate}% unprotected). Neonatal tetanus risk remains elevated. Immediate outreach recommended.`,
        `FORECAST: ${stats.seniorsWithHighBP} seniors (${Math.round(stats.seniorsWithHighBP / stats.totalSeniors * 100)}%) have uncontrolled hypertension. Without medication compliance improvement, cardiovascular events will increase.`,
        `WARNING: ${stats.tbPatientsWithMissedDoses} TB patients have missed multiple doses (${100 - stats.trends.tbAdherenceRate}% non-adherence). Drug resistance risk is HIGH. Strengthen DOTS supervision immediately.`,
        `PRIORITY: ${stats.criticalBarangays.length} barangays show high risk across multiple indicators: ${stats.criticalBarangays.join(", ")}. Allocate additional resources and personnel.`,
        `SURVEILLANCE: ${stats.topDiseases[0]?.condition || "Unknown"} leads with ${stats.topDiseases[0]?.count || 0} cases. Monitor for outbreak patterns in the next 1-2 months.`,
      ],
      stats,
    };
  }
}

export async function streamHealthInsights(onChunk: (text: string) => void): Promise<void> {
  const stats = await getEnhancedHealthStatistics();
  
  const prompt = `You are a predictive health analytics system for a Municipal Health Office in the Philippines.
Analyze this health data for Placer municipality and provide predictive insights, risk forecasts, and actionable recommendations.

CURRENT STATISTICS:
- Pregnant Mothers: ${stats.totalMothers} total, ${stats.activeMothers} active, ${stats.highRiskMothers} high-risk
- TT Vaccination Rate: ${stats.trends.ttVaccinationRate}% (${stats.mothersWithNoTT} without TT)
- Children: ${stats.totalChildren} total, ${stats.childrenMissingVaccines} missing vaccines, ${stats.highRiskChildren} high-risk
- Immunization Coverage: ${stats.trends.immunizationCoverageRate}% (Target: 95%)
- Seniors: ${stats.totalSeniors} total, ${stats.seniorsWithHighBP} with high BP, ${stats.highRiskSeniors} critical
- Medication Compliance: ${stats.trends.seniorMedComplianceRate}%
- Disease Cases: ${stats.totalDiseaseCases} total, ${stats.newDiseaseCases} new
- Top diseases: ${stats.topDiseases.map(d => `${d.condition} (${d.count})`).join(", ")}
- TB: ${stats.totalTBPatients} patients, ${stats.tbPatientsWithMissedDoses} with missed doses
- TB Adherence Rate: ${stats.trends.tbAdherenceRate}%

HIGH-RISK BARANGAYS: ${stats.criticalBarangays.join(", ") || "None"}

Provide analysis that includes:
1. PREDICTIONS: What will happen in the next 3-6 months based on current trends
2. RISK ALERTS: Immediate concerns requiring action
3. FORECASTS: Expected outcomes if current trends continue
4. RECOMMENDATIONS: Specific actions with target barangays and timeframes

Be specific with numbers, percentages, and barangay names. Include confidence levels for predictions.`;

  const stream = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    max_completion_tokens: 3000,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || "";
    if (content) {
      onChunk(content);
    }
  }
}

export async function getRiskAnalysis(): Promise<{ riskScores: RiskScore[]; predictions: Prediction[]; criticalBarangays: string[] }> {
  const stats = await getEnhancedHealthStatistics();
  return {
    riskScores: stats.riskScores,
    predictions: stats.predictions,
    criticalBarangays: stats.criticalBarangays,
  };
}
