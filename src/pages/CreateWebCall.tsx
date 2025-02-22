import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Video, Loader2, Code, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useParams } from "react-router-dom";

interface Agent {
  agent_id: string;
  agent_name: string | null;
}

const CreateWebCall = () => {
  const { agentId } = useParams();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState(agentId || "");
  const [loading, setLoading] = useState(false);
  const [fetchingAgents, setFetchingAgents] = useState(!agentId);
  const [showCodeSnippet, setShowCodeSnippet] = useState(false);
  const [copied, setCopied] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const widgetContainerRef = useRef<HTMLDivElement>(null);
  const widgetInstanceRef = useRef<any>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!agentId) {
      const fetchAgents = async () => {
        try {
          setFetchingAgents(true);
          
          const { data: apiResponse, error: apiError } = await supabase.functions.invoke(
            'retell-calls',
            {
              body: {
                action: 'getApiKey'
              }
            }
          );

          if (apiError || !apiResponse?.RETELL_API_KEY) {
            throw new Error("Failed to fetch API key");
          }

          const { data: agentsData, error: agentsError } = await supabase.functions.invoke(
            'retell-calls',
            {
              body: {
                action: 'listAgents'
              }
            }
          );

          if (agentsError) {
            throw agentsError;
          }

          setAgents(agentsData || []);
        } catch (err: any) {
          console.error('Error fetching agents:', err);
          toast({
            variant: "destructive",
            title: "Error fetching agents",
            description: err.message || "Failed to load agents",
          });
        } finally {
          setFetchingAgents(false);
        }
      };

      fetchAgents();
    } else {
      setFetchingAgents(false);
    }
  }, [agentId, toast]);

  useEffect(() => {
    return () => {
      if (widgetInstanceRef.current) {
        try {
          widgetInstanceRef.current.destroy();
          widgetInstanceRef.current = null;
        } catch (err) {
          console.error('Error cleaning up widget:', err);
        }
      }
    };
  }, []);

  const embedCodeSnippet = `
<!-- Add this to your HTML -->
<script src="https://cdn.retellai.com/sdk/web-sdk.js"></script>

<!-- Default widget styles -->
<style>
  #retell-call-widget {
    max-width: 400px;
    margin: 20px auto;
    padding: 20px;
    font-family: system-ui, -apple-system, sans-serif;
  }
  
  #retell-call-button {
    background-color: #2563eb;
    color: white;
    padding: 12px 24px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 16px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 auto;
  }
  
  #retell-call-button:hover {
    background-color: #1d4ed8;
  }

  #retell-call-button svg {
    width: 20px;
    height: 20px;
  }
</style>

<!-- Add this where you want the call widget to appear -->
<div id="retell-call-widget"></div>

<script>
const widget = Retell.widget.createCallWidget({
  containerId: 'retell-call-widget',
  accessToken: '${accessToken || 'YOUR_ACCESS_TOKEN'}',
  renderButton: true, // Enable default button rendering
  buttonConfig: {
    // Optional: Configure button appearance
    text: 'Start Call',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15.05 5A5 5 0 0 1 19 8.95M15.05 1A9 9 0 0 1 23 8.94m-1 7.98v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>'
  }
});
</script>
  `.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        'retell-calls',
        {
          body: {
            action: 'createWebCall',
            agent_id: selectedAgentId,
          }
        }
      );

      if (error) {
        throw error;
      }

      if (!data || !data.call_id || !data.access_token) {
        throw new Error("Invalid response from server");
      }

      setAccessToken(data.access_token);
      setShowCodeSnippet(true);

      toast({
        title: "Web call created successfully",
        description: `Call ID: ${data.call_id}`,
      });
    } catch (err: any) {
      console.error('Error creating web call:', err);
      toast({
        variant: "destructive",
        title: "Error creating web call",
        description: err.message || "Something went wrong",
      });
    } finally {
      setLoading(false);
    }
  };

  const initializeCall = async () => {
    if (!accessToken || !widgetContainerRef.current) return;

    try {
      // Clean up any existing widget
      if (widgetInstanceRef.current) {
        widgetInstanceRef.current.destroy();
        widgetInstanceRef.current = null;
      }

      console.log('Initializing Retell Widget...');
      
      // Create new widget instance
      // @ts-ignore - Retell will be available globally
      widgetInstanceRef.current = Retell.widget.createCallWidget({
        containerId: 'retell-call-widget',
        accessToken: accessToken,
        renderButton: true, // Enable default button rendering
        buttonConfig: {
          // Configure button appearance for the app
          text: 'Start Call',
          icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15.05 5A5 5 0 0 1 19 8.95M15.05 1A9 9 0 0 1 23 8.94m-1 7.98v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>'
        },
        onCallStarted: () => {
          console.log("Call started");
          setIsCallActive(true);
          toast({
            title: "Call started",
            description: "You are now connected with the agent",
          });
        },
        onCallEnded: () => {
          console.log("Call ended");
          setIsCallActive(false);
          toast({
            title: "Call ended",
            description: "The call has been disconnected",
          });
        },
        onError: (error: any) => {
          console.error("Call error:", error);
          setIsCallActive(false);
          toast({
            variant: "destructive",
            title: "Call error",
            description: error.message || "An error occurred during the call",
          });
        }
      });
    } catch (err) {
      console.error('Error initializing widget:', err);
      toast({
        variant: "destructive",
        title: "Error initializing call",
        description: "Failed to start the call. Please try again.",
      });
    }
  };

  const handleEndCall = () => {
    if (widgetInstanceRef.current) {
      try {
        widgetInstanceRef.current.destroy();
        widgetInstanceRef.current = null;
        setIsCallActive(false);
      } catch (err) {
        console.error('Error ending call:', err);
      }
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(embedCodeSnippet);
      setCopied(true);
      toast({
        title: "Code copied",
        description: "The code snippet has been copied to your clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Failed to copy",
        description: "Please try copying the code manually",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-6 w-6" />
              {agentId ? "Start Web Call" : "Create New Web Call"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Select Agent
                </label>
                {agentId ? (
                  <input
                    type="text"
                    value={selectedAgentId}
                    disabled
                    className="w-full bg-gray-100 border border-gray-300 rounded-md px-4 py-2"
                  />
                ) : fetchingAgents ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading agents...
                  </div>
                ) : (
                  <Select
                    value={selectedAgentId}
                    onValueChange={(value) => {
                      setSelectedAgentId(value);
                      navigate(`/create-web-call/${value}`);
                    }}
                    required
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select an agent" />
                    </SelectTrigger>
                    <SelectContent>
                      {agents.map((agent) => (
                        <SelectItem 
                          key={agent.agent_id} 
                          value={agent.agent_id}
                          className="font-mono"
                        >
                          {agent.agent_name || agent.agent_id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <p className="text-sm text-gray-500">
                  {agentId ? "Using pre-selected agent" : "Choose the agent that will handle this web call"}
                </p>
              </div>

              <Button 
                type="submit" 
                disabled={loading || fetchingAgents || !selectedAgentId}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Web Call"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {accessToken && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Video className="h-6 w-6" />
                  Connect to Agent
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-500">
                  Click the button below to start the call with the agent. Make sure your microphone is enabled.
                </p>
                <div id="retell-call-widget" ref={widgetContainerRef} className="mt-4" />
                {isCallActive && (
                  <Button
                    onClick={handleEndCall}
                    className="w-full"
                    variant="destructive"
                  >
                    End Call
                  </Button>
                )}
              </CardContent>
            </Card>

            {showCodeSnippet && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Code className="h-6 w-6" />
                    Code Snippet
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative bg-gray-900 text-gray-100 p-4 rounded-md overflow-x-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      className="absolute right-2 top-2"
                      onClick={handleCopyCode}
                    >
                      {copied ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                    <pre className="text-sm">
                      <code>{embedCodeSnippet}</code>
                    </pre>
                  </div>
                  <p className="mt-4 text-sm text-gray-500">
                    Use this code snippet to integrate the web call widget into your website.
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CreateWebCall;
