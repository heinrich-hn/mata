import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { CheckCircle, Download, Monitor, Plus, Share, Smartphone } from "lucide-react";

const Admin = () => {
  const { isInstallable, isInstalled, isIOS, isAndroid, isWindows, isMobile, promptInstall } = usePWAInstall();

  const handleInstall = async () => {
    await promptInstall();
  };

  const getPlatformName = () => {
    if (isAndroid) return "Android";
    if (isWindows) return "Windows";
    if (isIOS) return "iOS";
    return "your device";
  };

  return (
    <Layout>
      <div className="space-y-6">
        <Tabs defaultValue="deployment" className="space-y-6">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="deployment">Deployment Status</TabsTrigger>
            <TabsTrigger value="system">System Configuration</TabsTrigger>
            <TabsTrigger value="costs">Cost Configuration</TabsTrigger>
            <TabsTrigger value="install">Install App</TabsTrigger>
          </TabsList>

          <TabsContent value="deployment">
            <Card>
              <CardHeader>
                <CardTitle>Deployment Status</CardTitle>
                <CardDescription>Monitor system deployment and health</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Deployment status monitoring will be implemented here.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="system">
            <Card>
              <CardHeader>
                <CardTitle>System Configuration</CardTitle>
                <CardDescription>Configure system-wide settings</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">System configuration options will be implemented here.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="costs">
            <Card>
              <CardHeader>
                <CardTitle>Cost Configuration</CardTitle>
                <CardDescription>Configure system cost parameters</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Cost configuration settings will be implemented here.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="install">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {isMobile ? <Smartphone className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
                    Install on {getPlatformName()}
                  </CardTitle>
                  <CardDescription>
                    Install Matanuska Transport as a native app on your device
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isInstalled ? (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-medium">App is already installed!</span>
                    </div>
                  ) : isIOS ? (
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        To install on iOS, follow these steps in Safari:
                      </p>
                      <ol className="list-none space-y-3 text-sm">
                        <li className="flex items-start gap-3">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
                            1
                          </span>
                          <span className="flex items-center gap-2">
                            Tap the Share button <Share className="h-4 w-4 inline" />
                          </span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
                            2
                          </span>
                          <span>Scroll down and tap "Add to Home Screen"</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
                            3
                          </span>
                          <span className="flex items-center gap-2">
                            Tap <Plus className="h-4 w-4 inline" /> Add
                          </span>
                        </li>
                      </ol>
                    </div>
                  ) : isInstallable ? (
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Click the button below to install the app. It will appear on your {isAndroid ? "home screen" : "desktop/taskbar"}.
                      </p>
                      <Button onClick={handleInstall} size="lg" className="w-full">
                        <Download className="h-5 w-5 mr-2" />
                        Install App
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Installation is not available in this browser. Try using Chrome, Edge, or Safari.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>App Benefits</CardTitle>
                  <CardDescription>
                    Why install as an app?
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <Download className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-sm">Works Offline</p>
                        <p className="text-xs text-muted-foreground">
                          Access your data even without internet connection
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <Smartphone className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-sm">Quick Launch</p>
                        <p className="text-xs text-muted-foreground">
                          Open directly from your home screen or taskbar
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <Monitor className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-sm">Full Screen Experience</p>
                        <p className="text-xs text-muted-foreground">
                          No browser UI for a native app feel
                        </p>
                      </div>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Admin;