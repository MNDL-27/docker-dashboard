import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download, Upload, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

interface Config {
  apiBase: string;
  defaultRefreshInterval: number;
}

const Config = () => {
  const [config, setConfig] = useState<Config>({
    apiBase: '',
    defaultRefreshInterval: 2000,
  });
  const [hasChanges, setHasChanges] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Load existing config
    const stored = localStorage.getItem('dockerDashboardConfig');
    if (stored) {
      try {
        const parsedConfig = JSON.parse(stored);
        setConfig({
          apiBase: parsedConfig.apiBase || '',
          defaultRefreshInterval: parsedConfig.defaultRefreshInterval || 2000,
        });
      } catch (err) {
        console.error('Failed to parse stored config:', err);
      }
    }
  }, []);

  const handleSave = () => {
    try {
      localStorage.setItem('dockerDashboardConfig', JSON.stringify(config));
      setHasChanges(false);
      toast({
        title: "Configuration Saved",
        description: "Your settings have been saved successfully.",
      });
    } catch (err) {
      toast({
        title: "Save Failed",
        description: "Failed to save configuration to localStorage.",
        variant: "destructive",
      });
    }
  };

  const handleExport = () => {
    try {
      const dataStr = JSON.stringify(config, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const exportFileDefaultName = 'docker-dashboard-config.json';
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
      
      toast({
        title: "Config Exported",
        description: "Configuration has been downloaded as JSON file.",
      });
    } catch (err) {
      toast({
        title: "Export Failed",
        description: "Failed to export configuration.",
        variant: "destructive",
      });
    }
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedConfig = JSON.parse(e.target?.result as string);
        setConfig({
          apiBase: importedConfig.apiBase || '',
          defaultRefreshInterval: importedConfig.defaultRefreshInterval || 2000,
        });
        setHasChanges(true);
        toast({
          title: "Config Imported",
          description: "Configuration has been loaded. Don't forget to save!",
        });
      } catch (err) {
        toast({
          title: "Import Failed",
          description: "Invalid JSON file or unsupported format.",
          variant: "destructive",
        });
      }
    };
    reader.readAsText(file);
    
    // Reset the input
    event.target.value = '';
  };

  const handleChange = (field: keyof Config, value: string | number) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-dashboard-header border-b border-border p-4">
        <div className="container mx-auto flex items-center gap-4">
          <Link to="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Dashboard
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-foreground">Configuration</h1>
        </div>
      </header>

      <main className="container mx-auto p-6 max-w-2xl">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>API Settings</CardTitle>
              <CardDescription>
                Configure the backend API connection settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="apiBase">API Base URL</Label>
                <Input
                  id="apiBase"
                  type="text"
                  placeholder="Leave empty for same origin"
                  value={config.apiBase}
                  onChange={(e) => handleChange('apiBase', e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Override the base URL for API calls. Useful when hosting with path prefixes.
                  Example: https://example.com/myapp
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="refreshInterval">Default Refresh Interval (ms)</Label>
                <Input
                  id="refreshInterval"
                  type="number"
                  min="500"
                  max="30000"
                  step="500"
                  value={config.defaultRefreshInterval}
                  onChange={(e) => handleChange('defaultRefreshInterval', parseInt(e.target.value) || 2000)}
                />
                <p className="text-sm text-muted-foreground">
                  Default interval for WebSocket stats updates (500ms - 30s)
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Security Notice
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                <strong>Important:</strong> Do not store secrets or API keys in this configuration. 
                Browser localStorage is not secure and can be accessed by any script on the page.
                This configuration is only for connection settings.
              </p>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleExport}
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
              
              <div className="relative">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Button variant="outline">
                  <Upload className="w-4 h-4 mr-2" />
                  Import
                </Button>
              </div>
            </div>

            <Button 
              onClick={handleSave}
              disabled={!hasChanges}
            >
              Save Configuration
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Config;