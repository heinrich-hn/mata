import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDriverAuth } from '@/hooks/useDriverAuth';
import type { Driver } from '@/hooks/useDrivers';
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
  Smartphone,
} from 'lucide-react';
import { useEffect, useState } from 'react';

interface CreateDriverAuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driver: Driver | null;
  onSuccess?: () => void;
}

export const CreateDriverAuthDialog = ({
  open,
  onOpenChange,
  driver,
  onSuccess,
}: CreateDriverAuthDialogProps) => {
  const { createAuthProfile, isCreatingProfile, generatePassword } = useDriverAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [createdCredentials, setCreatedCredentials] = useState<{
    email: string;
    password: string;
    username: string;
  } | null>(null);

  // Reset form when dialog opens with new driver
  useEffect(() => {
    if (open && driver) {
      setEmail(driver.email || '');
      setPassword(generatePassword());
      setShowPassword(false);
      setCopiedPassword(false);
      setStep('form');
      setCreatedCredentials(null);
    }
  }, [open, driver, generatePassword]);

  const handleGeneratePassword = () => {
    setPassword(generatePassword());
    setShowPassword(true);
    setCopiedPassword(false);
  };

  const handleCopyPassword = async () => {
    await navigator.clipboard.writeText(password);
    setCopiedPassword(true);
    setTimeout(() => setCopiedPassword(false), 2000);
  };

  const handleCreate = async () => {
    if (!driver || !email || !password) return;

    try {
      const result = await createAuthProfile({
        driverId: driver.id,
        email,
        password,
        firstName: driver.first_name,
        lastName: driver.last_name,
      });

      setCreatedCredentials({
        email,
        password,
        username: result.username,
      });
      setStep('success');
      onSuccess?.();
    } catch {
      // Error handled by hook
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset state after animation
    setTimeout(() => {
      setStep('form');
      setCreatedCredentials(null);
    }, 200);
  };

  if (!driver) return null;

  const driverFullName = `${driver.first_name} ${driver.last_name}`;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            {step === 'form' ? 'Create Mobile App Profile' : 'Profile Created Successfully'}
          </DialogTitle>
          <DialogDescription>
            {step === 'form' ? (
              <>Create an authenticated profile so <strong>{driverFullName}</strong> can access the mobile app.</>
            ) : (
              <>The driver can now log in to the mobile app with these credentials.</>
            )}
          </DialogDescription>
        </DialogHeader>

        {step === 'form' ? (
          <>
            {/* Driver Info Summary */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Driver</span>
                <span className="text-sm">{driverFullName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Driver #</span>
                <Badge variant="secondary">{driver.driver_number}</Badge>
              </div>
              {driver.phone && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Phone</span>
                  <span className="text-sm text-muted-foreground">{driver.phone}</span>
                </div>
              )}
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="auth-email">
                  Email Address <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="driver@company.com"
                />
                {!email && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Email is required for mobile app login
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="auth-password">
                  Temporary Password <span className="text-destructive">*</span>
                </Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="auth-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleGeneratePassword}
                    title="Generate new password"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleCopyPassword}
                    title="Copy password"
                  >
                    {copiedPassword ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Share this password with the driver. They can change it after first login.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={isCreatingProfile || !email || !password}
              >
                {isCreatingProfile && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Profile
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            {/* Success State */}
            <div className="space-y-4">
              <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-4 text-center">
                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-2" />
                <p className="font-medium text-green-700 dark:text-green-400">
                  Mobile profile created!
                </p>
              </div>

              <div className="bg-muted rounded-lg p-4 space-y-3">
                <p className="text-sm font-medium text-center mb-3">Login Credentials</p>

                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 bg-background rounded">
                    <span className="text-sm text-muted-foreground">Email:</span>
                    <code className="text-sm font-mono">{createdCredentials?.email}</code>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-background rounded">
                    <span className="text-sm text-muted-foreground">Password:</span>
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono">
                        {showPassword ? createdCredentials?.password : '••••••••••'}
                      </code>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={async () => {
                    const text = `Mobile App Login Credentials for ${driverFullName}:\n\nEmail: ${createdCredentials?.email}\nPassword: ${createdCredentials?.password}\n\nPlease change your password after first login.`;
                    await navigator.clipboard.writeText(text);
                    setCopiedPassword(true);
                    setTimeout(() => setCopiedPassword(false), 2000);
                  }}
                >
                  {copiedPassword ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Credentials
                    </>
                  )}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Make sure to share these credentials securely with the driver.
              </p>
            </div>

            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CreateDriverAuthDialog;
