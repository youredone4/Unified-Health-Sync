import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ComingSoonCardProps {
  title: string;
  icon: React.ElementType;
  description: string;
  testId: string;
}

export function ComingSoonCard({ title, icon: Icon, description, testId }: ComingSoonCardProps) {
  return (
    <Card className="opacity-70 border-dashed" data-testid={testId}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className="w-4 h-4 text-muted-foreground" />
          {title}
          <Badge variant="outline" className="ml-auto text-xs font-normal">
            Coming soon
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
