import { useState, useEffect } from "react";
import { useTheme, colorSchemePresets } from "@/contexts/theme-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Settings, Palette, Building2, Image, Check, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const { settings, updateSettings, isPending, isLoading } = useTheme();
  const { toast } = useToast();

  const [lguName, setLguName] = useState("");
  const [lguSubtitle, setLguSubtitle] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [colorScheme, setColorScheme] = useState("healthcare-green");
  const [primaryHue, setPrimaryHue] = useState(152);
  const [primarySaturation, setPrimarySaturation] = useState(60);
  const [primaryLightness, setPrimaryLightness] = useState(40);

  useEffect(() => {
    if (settings) {
      setLguName(settings.lguName || "");
      setLguSubtitle(settings.lguSubtitle || "");
      setLogoUrl(settings.logoUrl || "");
      setColorScheme(settings.colorScheme || "healthcare-green");
      setPrimaryHue(settings.primaryHue ?? 152);
      setPrimarySaturation(settings.primarySaturation ?? 60);
      setPrimaryLightness(settings.primaryLightness ?? 40);
    }
  }, [settings]);

  const handleColorSchemeChange = (scheme: string) => {
    setColorScheme(scheme);
    if (scheme !== "custom" && colorSchemePresets[scheme]) {
      const preset = colorSchemePresets[scheme];
      setPrimaryHue(preset.hue);
      setPrimarySaturation(preset.saturation);
      setPrimaryLightness(preset.lightness);
    }
  };

  const handleSave = () => {
    updateSettings({
      lguName,
      lguSubtitle,
      logoUrl: logoUrl || null,
      colorScheme,
      primaryHue,
      primarySaturation,
      primaryLightness,
    });
    toast({
      title: "Settings Saved",
      description: "Your branding and color settings have been updated.",
    });
  };

  const previewColor = `hsl(${primaryHue}, ${primarySaturation}%, ${primaryLightness}%)`;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <Settings className="w-6 h-6 text-primary" />
          System Settings
        </h1>
        <p className="text-muted-foreground">
          Customize the appearance for your city or municipality
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              LGU Branding
            </CardTitle>
            <CardDescription>
              Set your local government unit name and logo
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="lguName">LGU Name</Label>
              <Input
                id="lguName"
                data-testid="input-lgu-name"
                placeholder="e.g., Placer Municipality"
                value={lguName}
                onChange={(e) => setLguName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lguSubtitle">Subtitle / Province</Label>
              <Input
                id="lguSubtitle"
                data-testid="input-lgu-subtitle"
                placeholder="e.g., Province of Surigao del Norte"
                value={lguSubtitle}
                onChange={(e) => setLguSubtitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="logoUrl" className="flex items-center gap-2">
                <Image className="w-4 h-4" />
                Logo URL
              </Label>
              <Input
                id="logoUrl"
                data-testid="input-logo-url"
                placeholder="https://example.com/logo.png"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Enter a URL to your LGU logo image (PNG or SVG recommended)
              </p>
            </div>
            {logoUrl && (
              <div className="p-4 border rounded-md bg-muted/50">
                <p className="text-xs text-muted-foreground mb-2">Logo Preview:</p>
                <img 
                  src={logoUrl} 
                  alt="LGU Logo Preview" 
                  className="h-12 object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5" />
              Color Scheme
            </CardTitle>
            <CardDescription>
              Choose colors that match your LGU branding
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Color Preset</Label>
              <Select value={colorScheme} onValueChange={handleColorSchemeChange}>
                <SelectTrigger data-testid="select-color-scheme">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(colorSchemePresets).map(([key, preset]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 rounded-full border"
                          style={{ backgroundColor: `hsl(${preset.hue}, ${preset.saturation}%, ${preset.lightness}%)` }}
                        />
                        {preset.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {colorScheme === "custom" && (
              <>
                <div className="space-y-2">
                  <Label>Hue: {primaryHue}</Label>
                  <Slider
                    value={[primaryHue]}
                    onValueChange={(v) => setPrimaryHue(v[0])}
                    min={0}
                    max={360}
                    step={1}
                    data-testid="slider-hue"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Saturation: {primarySaturation}%</Label>
                  <Slider
                    value={[primarySaturation]}
                    onValueChange={(v) => setPrimarySaturation(v[0])}
                    min={0}
                    max={100}
                    step={1}
                    data-testid="slider-saturation"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Lightness: {primaryLightness}%</Label>
                  <Slider
                    value={[primaryLightness]}
                    onValueChange={(v) => setPrimaryLightness(v[0])}
                    min={20}
                    max={60}
                    step={1}
                    data-testid="slider-lightness"
                  />
                </div>
              </>
            )}

            <div className="p-4 border rounded-md bg-muted/50">
              <p className="text-xs text-muted-foreground mb-2">Color Preview:</p>
              <div className="flex items-center gap-3">
                <div 
                  className="w-12 h-12 rounded-md border-2"
                  style={{ backgroundColor: previewColor }}
                />
                <div className="space-y-1">
                  <div 
                    className="text-sm font-semibold"
                    style={{ color: previewColor }}
                  >
                    Primary Color
                  </div>
                  <div className="text-xs text-muted-foreground">
                    HSL({primaryHue}, {primarySaturation}%, {primaryLightness}%)
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Preview Your Changes</h3>
              <p className="text-sm text-muted-foreground">
                The sidebar and header will update when you save
              </p>
            </div>
            <Button 
              onClick={handleSave} 
              disabled={isPending}
              data-testid="button-save-settings"
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              Save Settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
