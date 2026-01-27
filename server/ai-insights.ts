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

export async function generateHealthInsights(): Promise<{ insights: string[]; stats: HealthStats }> {
  const stats = await getHealthStatistics();
  
  const prompt = `You are a public health analyst assistant for a Municipal Health Office in the Philippines.
Based on the following health statistics for Placer municipality (20 barangays), generate 5-7 specific, actionable insights and recommendations.

HEALTH STATISTICS:
- Total Pregnant Mothers: ${stats.totalMothers} (${stats.activeMothers} active, ${stats.deliveredMothers} delivered)
- Mothers without any TT vaccination: ${stats.mothersWithNoTT}
- Mothers with complete TT (5 doses): ${stats.mothersWithCompleteTT}
- Total Children: ${stats.totalChildren} (${stats.childrenUnder1.length} under 1 year old)
- Children with complete primary vaccines: ${stats.childrenWithCompletePrimaryVaccines}
- Children missing age-appropriate vaccines: ${stats.childrenMissingVaccines}
- Low birth weight children: ${stats.lowBirthWeightChildren}
- Total Seniors: ${stats.totalSeniors}
- Seniors with medication pickup due: ${stats.seniorsWithMedsDue}
- Seniors with high BP (>=140 systolic): ${stats.seniorsWithHighBP}
- Total Disease Cases: ${stats.totalDiseaseCases} (${stats.newDiseaseCases} new)
- Top diseases: ${stats.topDiseases.map(d => `${d.condition}: ${d.count}`).join(", ")}
- Total TB Patients: ${stats.totalTBPatients} (${stats.tbPatientsOngoing} ongoing treatment)
- TB Patients with >2 missed doses: ${stats.tbPatientsWithMissedDoses}

BARANGAY BREAKDOWN (top concerns by module count):
${Object.entries(stats.barangayBreakdown)
  .sort((a, b) => (b[1].mothers + b[1].children + b[1].seniors) - (a[1].mothers + a[1].children + a[1].seniors))
  .slice(0, 10)
  .map(([name, data]) => `${name}: ${data.mothers} mothers, ${data.children} children, ${data.seniors} seniors, ${data.diseases} disease cases, ${data.tb} TB`)
  .join("\n")}

Generate specific, actionable insights focused on:
1. Immunization coverage gaps and recommended outreach
2. Prenatal care priorities (TT vaccination, high-risk pregnancies)
3. Senior citizen medication compliance
4. Disease surveillance patterns
5. TB DOTS adherence
6. Resource allocation recommendations

Format each insight as a single paragraph. Be specific with numbers and barangay names where relevant.
Return ONLY a JSON array of strings, each string being one insight. No other text.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_completion_tokens: 2048,
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
        `Based on current data: ${stats.childrenMissingVaccines} children are behind on vaccinations. Consider scheduling community immunization drives.`,
        `${stats.mothersWithNoTT} pregnant mothers have not received any TT vaccination. Prioritize prenatal outreach in affected barangays.`,
        `${stats.seniorsWithMedsDue} seniors have medication pickups due. Send SMS reminders to improve compliance.`,
        `${stats.newDiseaseCases} new disease cases require monitoring. Top conditions: ${stats.topDiseases.slice(0, 3).map(d => d.condition).join(", ")}.`,
        `${stats.tbPatientsWithMissedDoses} TB patients have missed multiple doses. Schedule home visits to ensure treatment adherence.`,
      ],
      stats,
    };
  }
}

export async function streamHealthInsights(onChunk: (text: string) => void): Promise<void> {
  const stats = await getHealthStatistics();
  
  const prompt = `You are a public health analyst for a Municipal Health Office in the Philippines.
Analyze this health data for Placer municipality and provide actionable recommendations.

CURRENT STATISTICS:
- Pregnant Mothers: ${stats.totalMothers} total, ${stats.activeMothers} active prenatal
- TT Vaccination: ${stats.mothersWithNoTT} mothers without TT, ${stats.mothersWithCompleteTT} with complete series
- Children: ${stats.totalChildren} total, ${stats.childrenMissingVaccines} missing vaccines, ${stats.lowBirthWeightChildren} low birth weight
- Seniors: ${stats.totalSeniors} total, ${stats.seniorsWithMedsDue} with meds due, ${stats.seniorsWithHighBP} with high BP
- Disease Cases: ${stats.totalDiseaseCases} total, ${stats.newDiseaseCases} new cases
- Top diseases: ${stats.topDiseases.map(d => `${d.condition} (${d.count})`).join(", ")}
- TB: ${stats.totalTBPatients} patients, ${stats.tbPatientsOngoing} ongoing, ${stats.tbPatientsWithMissedDoses} with missed doses

Provide 5 specific, actionable insights with barangay-level recommendations where possible. Focus on immediate priorities.`;

  const stream = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    max_completion_tokens: 2048,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || "";
    if (content) {
      onChunk(content);
    }
  }
}
