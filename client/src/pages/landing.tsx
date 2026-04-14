import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ThemeSettings, Barangay } from "@shared/schema";
import { Loader2, Eye, EyeOff, CheckCircle, ArrowLeft, ArrowRight, Upload, X, Camera, RefreshCw } from "lucide-react";

interface LastLoginInfo {
  role?: string;
  barangay?: string;
}

interface LoginCredentials {
  username: string;
  password: string;
}

const ID_TYPES = [
  "PhilSys ID (National ID)",
  "Driver's License",
  "Passport",
  "SSS ID",
  "GSIS ID",
  "Voter's ID",
  "PRC ID",
  "Postal ID",
  "Barangay ID",
  "Other Government ID",
];

const ROLE_OPTIONS = [
  { value: "SHA", label: "Senior Health Admin (SHA)" },
  { value: "TL", label: "Team Leader / Barangay Nurse (TL)" },
];

type RegistrationStep = 1 | 2 | 3 | 4;

export default function LandingPage() {
  const [lastLogin, setLastLogin] = useState<LastLoginInfo>({});
  const [mode, setMode] = useState<"login" | "register">("login");

  // Login state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Registration state
  const [regStep, setRegStep] = useState<RegistrationStep>(1);
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [regShowPassword, setRegShowPassword] = useState(false);
  const [regFullName, setRegFullName] = useState("");
  const [regContact, setRegContact] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regRole, setRegRole] = useState("TL");
  const [regBarangayIds, setRegBarangayIds] = useState<number[]>([]);
  const [regIdType, setRegIdType] = useState("");
  const [regIdFile, setRegIdFile] = useState<File | null>(null);
  const [regSelfie, setRegSelfie] = useState<File | null>(null);

  const { toast } = useToast();

  const [loginError, setLoginError] = useState<{
    type: "error" | "pending" | "rejected" | "disabled";
    message: string;
  } | null>(null);

  const { data: settings } = useQuery<ThemeSettings>({
    queryKey: ["/api/theme-settings"],
  });

  const { data: barangays = [] } = useQuery<Barangay[]>({
    queryKey: ["/api/barangays"],
    enabled: mode === "register",
  });

  useEffect(() => {
    const stored = localStorage.getItem("lastLoginInfo");
    if (stored) {
      try {
        setLastLogin(JSON.parse(stored));
      } catch {
        setLastLogin({});
      }
    }
  }, []);

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) {
        const err = new Error(data.message || "Login failed") as Error & { statusCode?: string };
        err.statusCode = data.statusCode;
        throw err;
      }
      return data;
    },
    onSuccess: () => {
      setLoginError(null);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      window.location.reload();
    },
    onError: (error: Error & { statusCode?: string }) => {
      const statusCode = error.statusCode;
      if (statusCode === "PENDING_VERIFICATION") {
        setLoginError({ type: "pending", message: error.message });
      } else if (statusCode === "REJECTED") {
        setLoginError({ type: "rejected", message: error.message });
      } else if (statusCode === "DISABLED") {
        setLoginError({ type: "disabled", message: error.message });
      } else {
        setLoginError({ type: "error", message: "Invalid username or password. Please check your credentials." });
      }
    },
  });

  const registerMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("username", regUsername.trim());
      formData.append("password", regPassword);
      formData.append("confirmPassword", regConfirmPassword);
      formData.append("fullName", regFullName.trim());
      formData.append("contactNumber", regContact.trim());
      if (regEmail.trim()) formData.append("email", regEmail.trim());
      formData.append("role", regRole);
      regBarangayIds.forEach(id => formData.append("barangayIds", String(id)));
      if (regIdType) formData.append("kycIdType", regIdType);
      if (regIdFile) formData.append("kycIdFile", regIdFile);
      if (regSelfie) formData.append("kycSelfie", regSelfie);

      const response = await fetch("/api/auth/register", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Registration failed");
      }
      return response.json();
    },
    onSuccess: () => {
      setRegStep(4);
    },
    onError: (error: Error) => {
      toast({
        title: "Registration Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    if (!username.trim() || !password.trim()) {
      setLoginError({ type: "error", message: "Please enter both username and password." });
      return;
    }
    loginMutation.mutate({ username: username.trim(), password });
  };

  const handleStep1Next = () => {
    if (!regUsername.trim()) {
      toast({ title: "Username required", variant: "destructive" }); return;
    }
    if (regPassword.length < 8) {
      toast({ title: "Password must be at least 8 characters", variant: "destructive" }); return;
    }
    if (regPassword !== regConfirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" }); return;
    }
    setRegStep(2);
  };

  const handleStep2Next = () => {
    if (!regFullName.trim()) {
      toast({ title: "Full name required", variant: "destructive" }); return;
    }
    if (!regContact.trim()) {
      toast({ title: "Contact number required", variant: "destructive" }); return;
    }
    if (regRole === "TL" && regBarangayIds.length === 0) {
      toast({ title: "Please select at least one barangay for Team Leader role", variant: "destructive" }); return;
    }
    setRegStep(3);
  };

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setSelfiePreview(null);
    setRegSelfie(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 640, height: 480 } });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch {
      setCameraError("Camera access denied. Please allow camera access and try again, or use a device with a camera.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
      setCameraStream(null);
    }
  }, [cameraStream]);

  const captureSelfie = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setSelfiePreview(dataUrl);
    canvas.toBlob((blob) => {
      if (blob) setRegSelfie(new File([blob], "selfie.jpg", { type: "image/jpeg" }));
    }, "image/jpeg", 0.85);
    stopCamera();
  }, [stopCamera]);

  const retakeSelfie = useCallback(() => {
    setSelfiePreview(null);
    setRegSelfie(null);
    startCamera();
  }, [startCamera]);

  useEffect(() => {
    if (regStep === 3 && !selfiePreview && !cameraStream) {
      startCamera();
    }
    if (regStep !== 3) {
      stopCamera();
      setSelfiePreview(null);
    }
  }, [regStep]);

  const handleStep3Submit = () => {
    if (!regIdType) {
      toast({ title: "Please select an ID type", variant: "destructive" }); return;
    }
    if (!regIdFile) {
      toast({ title: "Please upload a valid ID photo", variant: "destructive" }); return;
    }
    if (!regSelfie) {
      toast({ title: "Selfie photo is required. Please take a selfie using the camera.", variant: "destructive" }); return;
    }
    registerMutation.mutate();
  };

  const toggleBarangay = (id: number) => {
    setRegBarangayIds(prev =>
      prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]
    );
  };

  const resetRegistration = () => {
    setRegStep(1);
    setRegUsername(""); setRegPassword(""); setRegConfirmPassword("");
    setRegFullName(""); setRegContact(""); setRegEmail("");
    setRegRole("TL"); setRegBarangayIds([]);
    setRegIdType(""); setRegIdFile(null); setRegSelfie(null);
    stopCamera(); setSelfiePreview(null); setCameraError(null);
  };

  const isTeamLeader = lastLogin.role === "TL";
  const barangayName = lastLogin.barangay;
  const logoUrl = settings?.logoUrl;
  const lguName = settings?.lguName || "GeoHealthSync";
  const lguSubtitle = settings?.lguSubtitle || "Barangay Health System";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="flex flex-col items-center gap-6 max-w-sm w-full">
        {logoUrl && (
          <img src={logoUrl} alt={lguName} className="w-24 h-24 object-contain" data-testid="img-logo" />
        )}

        <div className="text-center">
          <h1 className="text-2xl font-bold" data-testid="text-lgu-name">
            {isTeamLeader && barangayName && mode === "login" ? `Barangay ${barangayName}` : lguName}
          </h1>
          <p className="text-muted-foreground" data-testid="text-subtitle">
            {isTeamLeader && barangayName && mode === "login" ? lguName : lguSubtitle}
          </p>
        </div>

        {/* === LOGIN FORM === */}
        {mode === "login" && (
          <Card className="w-full">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Sign In</CardTitle>
              <CardDescription>Enter your credentials to access the system</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                {loginError && (
                  <div
                    className={`rounded-md p-3 text-sm flex items-start gap-2 ${
                      loginError.type === "pending"
                        ? "bg-yellow-50 text-yellow-900 border border-yellow-200 dark:bg-yellow-950 dark:text-yellow-200 dark:border-yellow-800"
                        : loginError.type === "rejected"
                        ? "bg-red-50 text-red-900 border border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-800"
                        : loginError.type === "disabled"
                        ? "bg-orange-50 text-orange-900 border border-orange-200 dark:bg-orange-950 dark:text-orange-200 dark:border-orange-800"
                        : "bg-red-50 text-red-900 border border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-800"
                    }`}
                    data-testid="login-error-message"
                    role="alert"
                  >
                    <span className="shrink-0 mt-0.5">
                      {loginError.type === "pending" ? "⏳" :
                       loginError.type === "rejected" ? "🚫" :
                       loginError.type === "disabled" ? "🔒" : "⚠️"}
                    </span>
                    <span>{loginError.message}</span>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Enter username"
                    value={username}
                    onChange={(e) => { setUsername(e.target.value); setLoginError(null); }}
                    disabled={loginMutation.isPending}
                    data-testid="input-username"
                    autoComplete="username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter password"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setLoginError(null); }}
                      disabled={loginMutation.isPending}
                      data-testid="input-password"
                      autoComplete="current-password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      data-testid="button-toggle-password"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loginMutation.isPending} data-testid="button-login">
                  {loginMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Signing in...</> : "Sign In"}
                </Button>
              </form>
              <div className="mt-4 pt-4 border-t text-center">
                <span className="text-sm text-muted-foreground">
                  Don't have an account?{" "}
                  <button
                    className="text-primary hover:underline font-medium"
                    onClick={() => { setMode("register"); resetRegistration(); }}
                    data-testid="button-go-register"
                  >
                    Register here
                  </button>
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* === REGISTRATION FORM === */}
        {mode === "register" && (
          <Card className="w-full">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                {regStep < 4 && (
                  <button
                    onClick={() => {
                      if (regStep === 1) { setMode("login"); resetRegistration(); }
                      else setRegStep((s) => (s - 1) as RegistrationStep);
                    }}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    data-testid="button-back-registration"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                )}
                <div>
                  <CardTitle className="text-lg">
                    {regStep === 4 ? "Registration Submitted" : "Create Account"}
                  </CardTitle>
                  {regStep < 4 && (
                    <CardDescription>Step {regStep} of 3 — {
                      regStep === 1 ? "Account Setup" :
                      regStep === 2 ? "Personal Information" :
                      "Identity Verification (KYC)"
                    }</CardDescription>
                  )}
                </div>
              </div>
              {regStep < 4 && (
                <div className="flex gap-1 mt-2">
                  {[1, 2, 3].map(s => (
                    <div
                      key={s}
                      className={`h-1 flex-1 rounded-full ${s <= regStep ? "bg-primary" : "bg-muted"}`}
                    />
                  ))}
                </div>
              )}
            </CardHeader>
            <CardContent>
              {/* Step 1: Account Setup */}
              {regStep === 1 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reg-username">Username *</Label>
                    <Input
                      id="reg-username"
                      placeholder="Choose a username"
                      value={regUsername}
                      onChange={(e) => setRegUsername(e.target.value)}
                      data-testid="input-reg-username"
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-password">Password * (min 8 characters)</Label>
                    <div className="relative">
                      <Input
                        id="reg-password"
                        type={regShowPassword ? "text" : "password"}
                        placeholder="Create a password"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        data-testid="input-reg-password"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setRegShowPassword(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {regShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-confirm">Confirm Password *</Label>
                    <Input
                      id="reg-confirm"
                      type="password"
                      placeholder="Repeat your password"
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      data-testid="input-reg-confirm-password"
                    />
                    {regConfirmPassword && regPassword !== regConfirmPassword && (
                      <p className="text-xs text-destructive">Passwords do not match</p>
                    )}
                  </div>
                  <Button className="w-full" onClick={handleStep1Next} data-testid="button-reg-next-1">
                    Next <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              )}

              {/* Step 2: Personal Information */}
              {regStep === 2 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reg-fullname">Full Name * (as on your ID)</Label>
                    <Input
                      id="reg-fullname"
                      placeholder="e.g. Juan Dela Cruz"
                      value={regFullName}
                      onChange={(e) => setRegFullName(e.target.value)}
                      data-testid="input-reg-fullname"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-contact">Contact Number *</Label>
                    <Input
                      id="reg-contact"
                      placeholder="e.g. 09xxxxxxxxx"
                      value={regContact}
                      onChange={(e) => setRegContact(e.target.value)}
                      data-testid="input-reg-contact"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-email">Email Address (optional)</Label>
                    <Input
                      id="reg-email"
                      type="email"
                      placeholder="your@email.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      data-testid="input-reg-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Role *</Label>
                    <Select value={regRole} onValueChange={setRegRole}>
                      <SelectTrigger data-testid="select-reg-role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map(r => (
                          <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      System Admin and MHO roles cannot be self-registered.
                    </p>
                  </div>
                  {regRole === "TL" && (
                    <div className="space-y-2">
                      <Label>Assigned Barangay(s) *</Label>
                      <div className="grid grid-cols-2 gap-2 p-3 border rounded-md max-h-40 overflow-y-auto">
                        {barangays.map(b => (
                          <div key={b.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`reg-brgy-${b.id}`}
                              checked={regBarangayIds.includes(b.id)}
                              onCheckedChange={() => toggleBarangay(b.id)}
                              data-testid={`checkbox-reg-barangay-${b.id}`}
                            />
                            <label htmlFor={`reg-brgy-${b.id}`} className="text-xs cursor-pointer">{b.name}</label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <Button className="w-full" onClick={handleStep2Next} data-testid="button-reg-next-2">
                    Next <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              )}

              {/* Step 3: KYC Upload */}
              {regStep === 3 && (
                <div className="space-y-4">
                  <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                    Your identity will be verified by a system administrator before you can access the health system.
                    Upload your government ID, then take a selfie for identity verification.
                  </div>

                  {/* ID Type */}
                  <div className="space-y-2">
                    <Label>ID Type *</Label>
                    <Select value={regIdType} onValueChange={setRegIdType}>
                      <SelectTrigger data-testid="select-reg-id-type">
                        <SelectValue placeholder="Select ID type..." />
                      </SelectTrigger>
                      <SelectContent>
                        {ID_TYPES.map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* ID File Upload */}
                  <div className="space-y-2">
                    <Label>Valid ID Photo * (JPG, PNG, or PDF, max 10MB)</Label>
                    {regIdFile ? (
                      <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/50">
                        <Upload className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-sm truncate flex-1">{regIdFile.name}</span>
                        <button onClick={() => setRegIdFile(null)} className="text-muted-foreground hover:text-destructive">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center gap-2 p-4 border-2 border-dashed rounded-md cursor-pointer hover:border-primary transition-colors" data-testid="upload-id-file">
                        <Upload className="w-6 h-6 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Click to upload ID photo</span>
                        <input
                          type="file"
                          className="hidden"
                          accept=".jpg,.jpeg,.png,.pdf,.heic"
                          onChange={(e) => setRegIdFile(e.target.files?.[0] || null)}
                        />
                      </label>
                    )}
                  </div>

                  {/* Webcam Selfie Capture */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Camera className="w-4 h-4" />
                      Selfie Photo * (for identity verification)
                    </Label>

                    {/* Captured selfie preview */}
                    {selfiePreview ? (
                      <div className="space-y-2">
                        <div className="relative rounded-md overflow-hidden border bg-black">
                          <img src={selfiePreview} alt="Your selfie" className="w-full object-contain max-h-48" data-testid="img-selfie-preview" />
                          <div className="absolute top-2 right-2">
                            <span className="bg-green-600 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />Captured
                            </span>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={retakeSelfie}
                          data-testid="button-retake-selfie"
                        >
                          <RefreshCw className="w-4 h-4 mr-1" />Retake Selfie
                        </Button>
                      </div>
                    ) : cameraError ? (
                      <div className="space-y-2">
                        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
                          {cameraError}
                        </div>
                        <Button type="button" variant="outline" size="sm" className="w-full" onClick={startCamera} data-testid="button-retry-camera">
                          <Camera className="w-4 h-4 mr-1" />Try Again
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="relative rounded-md overflow-hidden bg-black border" style={{ minHeight: 192 }}>
                          <video
                            ref={videoRef}
                            className="w-full object-cover max-h-48"
                            autoPlay
                            playsInline
                            muted
                            data-testid="video-webcam"
                          />
                          {!cameraStream && (
                            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
                              <Loader2 className="w-5 h-5 animate-spin mr-2" />Starting camera...
                            </div>
                          )}
                        </div>
                        <Button
                          type="button"
                          className="w-full"
                          onClick={captureSelfie}
                          disabled={!cameraStream}
                          data-testid="button-capture-selfie"
                        >
                          <Camera className="w-4 h-4 mr-2" />Take Selfie
                        </Button>
                      </div>
                    )}
                    <canvas ref={canvasRef} className="hidden" />
                  </div>

                  <Button
                    className="w-full"
                    onClick={handleStep3Submit}
                    disabled={registerMutation.isPending}
                    data-testid="button-reg-submit"
                  >
                    {registerMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</>
                    ) : (
                      "Submit Registration"
                    )}
                  </Button>
                </div>
              )}

              {/* Step 4: Success */}
              {regStep === 4 && (
                <div className="text-center space-y-4 py-4">
                  <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
                  <h3 className="font-semibold text-lg">Registration Submitted!</h3>
                  <p className="text-sm text-muted-foreground">
                    Your account is now <strong>pending verification</strong>. A system administrator will review your
                    information and ID. You will be able to log in once your account is approved.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Username: <strong>{regUsername}</strong>
                  </p>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => { setMode("login"); resetRegistration(); }}
                    data-testid="button-go-login-after-register"
                  >
                    Back to Sign In
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <p className="text-xs text-muted-foreground text-center">
          HealthSync - Unified Digital Health Information System
        </p>
      </div>
    </div>
  );
}
