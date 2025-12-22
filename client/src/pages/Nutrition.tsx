import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";

export default function Nutrition() {
  return (
    <Layout title="Nutrition" subtitle="Underweight & Malnutrition Monitoring">
        <div className="flex items-center justify-center min-h-[400px]">
            <Card className="max-w-md w-full text-center p-8 bg-card border-border">
                <CardContent>
                    <h2 className="text-2xl font-bold mb-2">Under Construction</h2>
                    <p className="text-muted-foreground">The Nutrition module is currently being updated with new growth chart standards.</p>
                </CardContent>
            </Card>
        </div>
    </Layout>
  );
}
